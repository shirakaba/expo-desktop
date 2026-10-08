import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { getPolicy, runRelease, validateReleasePlan, type Runner } from "./release.ts";

const config = JSON.parse(
  readFileSync(new URL("../../../.changeset/expo-desktop.json", import.meta.url), "utf8"),
);

test("release policy routes current, future, maintenance and disabled branches", () => {
  assert.equal(getPolicy(config, "main").publish, "next");
  assert.equal(getPolicy(config, "sdk-55").publish, "latest");
  assert.equal(getPolicy(config, "sdk-54").publish, "sdk-54");
  assert.equal(getPolicy(config, "sdk-56").publish, "sdk-56");
  assert.throws(() => getPolicy(config, "feature/test"), /No release policy/);
  assert.equal(
    getPolicy({ ...config, branches: { main: { publish: null, allowMajor: true } } }, "main")
      .publish,
    null,
  );
});

test("SDK policy catches authored and dependency-propagated major bumps", () => {
  const release = { name: "library", oldVersion: "54.0.0", newVersion: "55.0.0", type: "major" };
  assert.throws(
    () => validateReleasePlan({ changesets: [], releases: [release] }, getPolicy(config, "sdk-54")),
    /Major bumps/,
  );
  assert.throws(
    () =>
      validateReleasePlan(
        { changesets: [{ releases: [{ name: "library", type: "major" }] }], releases: [] },
        getPolicy(config, "sdk-55"),
      ),
    /Major bumps/,
  );
  validateReleasePlan({ changesets: [], releases: [release] }, getPolicy(config, "main"));
  assert.throws(
    () =>
      validateReleasePlan(
        {
          changesets: [],
          releases: [{ ...release, name: "expo-desktop-template-bare-minimum", type: "minor" }],
        },
        getPolicy(config, "main"),
      ),
    /encodes React Native/,
  );
});

function fixture(t: TestContext, branch = "sdk-55", realPack = false) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), "expo-desktop-release-test-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const write = (file: string, contents: string | object) => {
    mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
    writeFileSync(
      path.join(cwd, file),
      typeof contents === "string" ? contents : JSON.stringify(contents, null, 2) + "\n",
    );
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", branch);
  git("config", "user.name", "Release tests");
  git("config", "user.email", "release-tests@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", path.join(cwd, "no-hooks"));
  write("package.json", {
    name: "fixture",
    version: "0.0.0",
    private: true,
    packageManager: "pnpm@12.9.1",
  });
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\npmOnFail: ignore\n");
  write(".changeset/config.json", {
    baseBranch: branch,
    access: "public",
    changelog: false,
    commit: false,
    fixed: [],
    linked: [],
    ignore: [],
    format: false,
    privatePackages: { version: true, tag: false },
  });
  write(".changeset/expo-desktop.json", config);
  write(".changeset/README.md", "Fixture\n");
  write("packages/library/package.json", { name: "library", version: "1.0.0" });
  const commit = () => {
    git("add", ".");
    git("commit", "-m", "Fixture commit");
  };
  commit();
  const calls: string[][] = [];
  let publishedVersions = ["1.0.0"];
  const distTags: Record<string, string> = { [getPolicy(config, branch).publish!]: "1.0.0" };
  let registryError: Error | undefined;
  let npm12 = false;
  let extraPlan: object[] = [];
  let packedPlan:
    | { plan: { kind: string; name: string; version: string; tag: string }[][] }
    | undefined;
  let packFails = false;
  let packedManifest: Record<string, any> | undefined;
  const run: Runner = (command, args, capture = false) => {
    calls.push([command, ...args]);
    if (command === "git") return git(...args);
    if (command === "npm") {
      if (registryError) throw registryError;
      if (args[0] === "dist-tag") {
        assert.equal(args[1], "add");
        distTags[args[3]!] = args[2]!.slice(args[2]!.lastIndexOf("@") + 1);
        return "";
      }
      assert.ok(args.includes("versions"));
      if (args.includes("dist-tags")) {
        const info = { versions: publishedVersions, "dist-tags": distTags };
        return JSON.stringify(npm12 ? [info] : info);
      }
      return JSON.stringify(publishedVersions);
    }
    if (command === "pnpm") {
      assert.ok(
        args.includes("--lockfile-only") || args.includes("build"),
        `Unexpected pnpm write: ${args}`,
      );
      return "";
    }
    assert.equal(command, process.execPath);
    const operation = args[1];
    if (operation === "status" || operation === "version") {
      return execFileSync(command, args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
    if (operation === "publish-plan") {
      if (registryError) throw registryError;
      const { name, version } = JSON.parse(
        readFileSync(path.join(cwd, "packages/library/package.json"), "utf8"),
      );
      writeFileSync(
        args[args.indexOf("--output") + 1]!,
        JSON.stringify({
          version: 1,
          plan: [
            extraPlan,
            publishedVersions.includes(version)
              ? []
              : [{ kind: "publish", name, version, tag: "latest", access: "public" }],
          ].filter((group) => group.length),
        }),
      );
    } else if (operation === "pack") {
      packedPlan = JSON.parse(readFileSync(args[args.indexOf("--from-publish-plan") + 1]!, "utf8"));
      if (packFails) throw new Error("Pack failed");
      if (realPack) {
        execFileSync(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
        const directory = args[args.indexOf("--out-dir") + 1]!;
        const packed = JSON.parse(readFileSync(path.join(directory, "publish-plan.json"), "utf8"));
        const library = packed.plan
          .flat()
          .find((entry: { name: string }) => entry.name === "library");
        packedManifest = JSON.parse(
          execFileSync(
            "tar",
            ["-xOf", path.join(directory, library.tarball.path), "package/package.json"],
            { encoding: "utf8" },
          ),
        );
      }
    } else {
      assert.equal(operation, "publish");
      assert.equal(args[2], "--from-pack-dir");
      assert.ok(args[3]!.endsWith("/packed"));
      for (const entry of packedPlan!.plan.flat()) {
        if (entry.kind === "publish" && entry.name === "library") {
          publishedVersions.push(entry.version);
          distTags[entry.tag] = entry.version;
        }
      }
      // Deliberately intercepted: tests never execute any registry writes.
    }
    return "";
  };
  const invoke = (
    command: "check" | "mode" | "version" | "publish",
    dryRun = false,
    env: NodeJS.ProcessEnv = {},
  ) => runRelease(command, { cwd, run, dryRun, env });
  const changeset = () => {
    write(".changeset/fix.md", '---\n"library": patch\n---\n\nFix the library.\n');
    commit();
  };
  const versionCommit = (manifest: object = {}) => {
    write("packages/library/package.json", { name: "library", version: "1.0.1", ...manifest });
    commit();
  };
  return {
    cwd,
    git,
    write,
    commit,
    calls,
    distTags,
    invoke,
    changeset,
    versionCommit,
    versions: (versions: string[]) => {
      publishedVersions = versions;
    },
    registryError: (error: Error) => {
      registryError = error;
    },
    useNpm12: () => {
      npm12 = true;
    },
    extraPlan: (entries: object[]) => {
      extraPlan = entries;
    },
    failPack: () => {
      packFails = true;
    },
    packedPlan: () => packedPlan,
    packedManifest: () => packedManifest,
  };
}

test("real Changesets versioning consumes committed intent and updates the lockfile only", async (t) => {
  const f = fixture(t);
  f.changeset();
  await f.invoke("version");
  assert.equal(
    JSON.parse(readFileSync(path.join(f.cwd, "packages/library/package.json"), "utf8")).version,
    "1.0.1",
  );
  assert.ok(
    f.calls.some(
      (call) =>
        call.includes("--lockfile-only") &&
        call.includes("--offline") &&
        call.includes("--ignore-scripts"),
    ),
  );
  assert.ok(!f.calls.some((call) => call[2] === "publish"));
});

test("mode uses pending changesets or the registry plan, not the latest commit", async (t) => {
  const f = fixture(t);
  const output = path.join(os.tmpdir(), path.basename(f.cwd) + ".output");
  t.after(() => rmSync(output, { force: true }));
  await f.invoke("mode", false, { GITHUB_OUTPUT: output });
  f.changeset();
  await f.invoke("mode", false, { GITHUB_OUTPUT: output });
  await f.invoke("version");
  f.commit();
  f.write("README.md", "An unrelated change after versioning.\n");
  f.commit();
  await f.invoke("mode", false, { GITHUB_OUTPUT: output });
  assert.equal(readFileSync(output, "utf8"), "mode=none\nmode=version\nmode=publish\n");
  assert.equal(f.calls.filter((call) => call[2] === "publish-plan").length, 2);
  assert.ok(!f.calls.some((call) => call.includes("HEAD^")));
});

test("an empty registry plan skips building and publishing but initializes Changesets output", async (t) => {
  const f = fixture(t);
  const output = path.join(f.cwd, ".git", "changesets-output.ndjson");
  await f.invoke("publish", true, { CHANGESETS_OUTPUT: output });
  assert.equal(existsSync(output), false);
  await f.invoke("publish", false, { CHANGESETS_OUTPUT: output });
  assert.equal(readFileSync(output, "utf8"), "");
  const event = JSON.stringify({ type: "git-tag", name: "library", version: "1.0.0" }) + "\n";
  writeFileSync(output, event);
  await f.invoke("publish", false, { CHANGESETS_OUTPUT: output });
  assert.equal(readFileSync(output, "utf8"), event);
  assert.ok(!f.calls.some((call) => call.includes("build") || call[2] === "publish"));
});

test("real Changesets and pnpm packing resolve workspace/catalog ranges without editing manifests", async (t) => {
  const f = fixture(t, "sdk-54", true);
  f.write(
    "pnpm-workspace.yaml",
    "packages:\n  - packages/*\npmOnFail: ignore\ncatalog:\n  external: 4.0.0\n",
  );
  f.write("packages/dependency/package.json", { name: "dependency", version: "2.0.0" });
  f.commit();
  f.versionCommit({ dependencies: { dependency: "workspace:^", external: "catalog:" } });
  await f.invoke("publish", true);
  assert.deepEqual(f.packedManifest()!.dependencies, { dependency: "^2.0.0", external: "4.0.0" });
  assert.equal(f.git("status", "--porcelain"), "");
});

test("the full plan includes unpublished dependencies and versions from separate commits", async (t) => {
  const f = fixture(t);
  f.write("packages/dependency/package.json", { name: "dependency", version: "1.0.0" });
  f.commit();
  f.write("packages/dependency/package.json", { name: "dependency", version: "1.0.1" });
  f.commit();
  f.versionCommit({ dependencies: { dependency: "workspace:^" } });
  f.write("README.md", "A later documentation change.\n");
  f.commit();
  f.extraPlan([
    { kind: "publish", name: "dependency", version: "1.0.1", tag: "latest", access: "public" },
  ]);
  await f.invoke("publish", true);
  assert.deepEqual(
    f.packedPlan()!.plan.map((group) => group.map((entry) => entry.name)),
    [["dependency"], ["library"]],
  );
  await f.invoke("publish");
  assert.ok(f.calls.some((call) => call[2] === "publish"));
});

test("version collisions and registry failures abort before changing files", async (t) => {
  const f = fixture(t);
  f.changeset();
  f.versions(["1.0.0", "1.0.1"]);
  await assert.rejects(f.invoke("version"), /already published/);
  assert.equal(f.git("status", "--porcelain"), "");
  f.registryError(new Error("Registry unavailable"));
  await assert.rejects(f.invoke("version"), /Registry unavailable/);
  assert.equal(f.git("status", "--porcelain"), "");
});

test("an npm E404 permits a first release", async (t) => {
  const f = fixture(t);
  f.changeset();
  f.registryError(
    Object.assign(new Error("Not found"), { stdout: JSON.stringify({ error: { code: "E404" } }) }),
  );
  await f.invoke("version");
});

for (const [branch, tag] of [
  ["main", "next"],
  ["sdk-54", "sdk-54"],
  ["sdk-55", "latest"],
]) {
  test(`publishing ${branch} builds and packs the full native plan with tag ${tag}`, async (t) => {
    const f = fixture(t, branch);
    f.versionCommit();
    f.extraPlan([{ kind: "publish", name: "unrelated", version: "1.0.0", tag: "latest" }]);
    await f.invoke("publish");
    const build = f.calls.findIndex((call) => call.includes("build"));
    const publish = f.calls.findIndex((call) => call[2] === "publish");
    assert.ok(build >= 0 && publish > build);
    assert.deepEqual(f.calls[build], ["pnpm", "--filter", "expo-desktop...", "build"]);
    const pack = f.calls.findIndex((call) => call[2] === "pack");
    assert.ok(pack > build && publish > pack);
    assert.ok(
      f
        .packedPlan()!
        .plan.flat()
        .every((entry) => entry.tag === tag),
    );
    assert.deepEqual(
      f.packedPlan()!.plan.map((group) => group.map((entry) => entry.name)),
      [["unrelated"], ["library"]],
    );
    assert.equal(f.git("status", "--porcelain"), "");
    assert.ok(!f.calls.some((call) => call[0] === "npm" && call[1] === "dist-tag"));
  });
}

test("dry runs build and pack without publishing or modifying manifests, even on packing failure", async (t) => {
  const f = fixture(t);
  f.versionCommit();
  await f.invoke("publish", true);
  assert.ok(f.packedPlan());
  assert.ok(f.calls.some((call) => call.includes("build")));
  assert.ok(!f.calls.some((call) => call[2] === "publish"));
  assert.equal(f.git("status", "--porcelain"), "");
  f.failPack();
  await assert.rejects(f.invoke("publish", true), /Pack failed/);
  assert.equal(f.git("status", "--porcelain"), "");
});

test("retries after later commits skip published versions without checking gitHead", async (t) => {
  const f = fixture(t);
  f.versionCommit();
  f.versions(["1.0.0", "1.0.1"]);
  f.write("README.md", "Fix CI after a partial publication.\n");
  f.commit();
  f.extraPlan([{ kind: "publish", name: "remaining", version: "1.0.0", tag: "latest" }]);
  await f.invoke("publish", true);
  assert.deepEqual(
    f
      .packedPlan()!
      .plan.flat()
      .map((entry) => entry.name),
    ["remaining"],
  );
  await f.invoke("publish");
  assert.ok(f.calls.some((call) => call[2] === "publish"));
  assert.ok(!f.calls.some((call) => call.includes("gitHead") || call.includes("HEAD^")));
  f.extraPlan([]);
  f.calls.length = 0;
  await f.invoke("publish");
  assert.ok(!f.calls.some((call) => call.includes("build") || call[2] === "publish"));
});

test("publishing refuses dirty trees and unconsumed changesets", async (t) => {
  const f = fixture(t);
  f.changeset();
  await assert.rejects(f.invoke("publish"), /Consume all pending changesets/);
  f.write("dirty.txt", "dirty");
  await assert.rejects(f.invoke("publish"), /clean working tree/);
});

test("mode and publishing work without any parent commit", async (t) => {
  const f = fixture(t);
  assert.equal(f.git("rev-list", "--count", "HEAD"), "1");
  f.versions([]);
  const output = path.join(os.tmpdir(), path.basename(f.cwd) + ".output");
  t.after(() => rmSync(output, { force: true }));
  await f.invoke("mode", false, { GITHUB_OUTPUT: output });
  assert.equal(readFileSync(output, "utf8"), "mode=publish\n");
  await f.invoke("publish");
  assert.ok(f.calls.some((call) => call[2] === "publish"));
});

test("tag-only plans reach Changesets without a build and dry runs never create tags", async (t) => {
  const f = fixture(t);
  f.extraPlan([{ kind: "tag-only", name: "private", version: "1.0.0" }]);
  await f.invoke("publish", true);
  assert.ok(!f.calls.some((call) => call[2] === "publish" || call[1] === "dist-tag"));
  await f.invoke("publish");
  assert.ok(f.calls.some((call) => call[2] === "publish"));
  assert.ok(!f.calls.some((call) => call.includes("build")));
});

test("registry plan failures stop mode selection and publication", async (t) => {
  const f = fixture(t);
  f.registryError(new Error("Registry unavailable"));
  await assert.rejects(f.invoke("mode"), /Registry unavailable/);
  await assert.rejects(f.invoke("publish"), /Registry unavailable/);
  assert.ok(!f.calls.some((call) => call.includes("build") || call[2] === "publish"));
});

test("disabled branches do not query the registry or publish", async (t) => {
  const f = fixture(t, "main");
  f.write(".changeset/expo-desktop.json", {
    ...config,
    branches: { main: { publish: null, allowMajor: true } },
  });
  f.commit();
  await f.invoke("mode");
  await assert.rejects(f.invoke("publish"), /Publishing is disabled/);
  assert.ok(!f.calls.some((call) => call[2] === "publish-plan"));
});

test("PR policy uses its base branch and refuses active prerelease mode", async (t) => {
  const f = fixture(t, "main");
  f.write(".changeset/breaking.md", '---\n"library": major\n---\n\nBreaking change.\n');
  f.commit();
  await assert.rejects(
    f.invoke("check", false, { GITHUB_BASE_REF: "sdk-55", GITHUB_REF_NAME: "123/merge" }),
    /Major bumps/,
  );
  f.write(".changeset/pre.json", { mode: "pre", tag: "beta" });
  f.commit();
  await assert.rejects(f.invoke("version"), /Exit Changesets prerelease mode/);
});

test("upgrading to npm 12 after mode selection still promotes the branch tag without a build", async (t) => {
  const f = fixture(t, "sdk-54");
  delete f.distTags["sdk-54"];
  f.distTags.latest = "1.0.0";
  const output = path.join(f.cwd, ".git", "mode-output");
  const changesetsOutput = path.join(f.cwd, ".git", "changesets-output.ndjson");
  const env = { CHANGESETS_OUTPUT: changesetsOutput };
  await f.invoke("mode", false, { ...env, GITHUB_OUTPUT: output });
  assert.equal(readFileSync(output, "utf8"), "mode=publish\n");
  assert.equal(existsSync(changesetsOutput), false);
  f.useNpm12();
  await f.invoke("publish", true, env);
  assert.deepEqual(f.distTags, { latest: "1.0.0" });
  assert.equal(existsSync(changesetsOutput), false);
  assert.ok(!f.calls.some((call) => call[1] === "dist-tag"));
  await f.invoke("publish", false, env);
  assert.deepEqual(f.distTags, { latest: "1.0.0", "sdk-54": "1.0.0" });
  assert.equal(readFileSync(changesetsOutput, "utf8"), "");
  assert.ok(
    !f.calls.some((call) => call.includes("build") || call[2] === "pack" || call[2] === "publish"),
  );
  f.calls.length = 0;
  await f.invoke("publish");
  assert.ok(!f.calls.some((call) => call[1] === "dist-tag"));
});

test("publication rechecks tags after mode selection, so a queued stale job cannot downgrade latest", async (t) => {
  const f = fixture(t);
  f.versionCommit();
  await f.invoke("mode");
  f.distTags.latest = "1.1.0";
  await assert.rejects(f.invoke("publish"), /would move latest backwards/);
  assert.ok(
    !f.calls.some(
      (call) => call.includes("build") || call[2] === "publish" || call[1] === "dist-tag",
    ),
  );
});

for (const branch of ["main", "sdk-54", "sdk-55"]) {
  test(`shared packages use only latest alongside SDK packages on ${branch}`, async (t) => {
    const f = fixture(t, branch, true);
    f.write("packages/shared/package.json", { name: "expo-desktop", version: "1.0.1" });
    f.versionCommit({ dependencies: { "expo-desktop": "workspace:^" } });
    f.extraPlan([
      { kind: "publish", name: "expo-desktop", version: "1.0.1", tag: "latest", access: "public" },
    ]);
    await f.invoke("publish", true);
    const entries = f.packedPlan()!.plan.flat();
    assert.equal(entries.find((entry) => entry.name === "expo-desktop")!.tag, "latest");
    assert.equal(
      entries.find((entry) => entry.name === "library")!.tag,
      getPolicy(config, branch).publish,
    );
    assert.equal(f.packedManifest()!.dependencies["expo-desktop"], "^1.0.1");
    assert.ok(!f.calls.some((call) => call[2] === "publish" || call[1] === "dist-tag"));
  });
}

test("private workspaces are never queried or promoted", async (t) => {
  const f = fixture(t);
  f.write("packages/private/package.json", { name: "private", version: "9.0.0", private: true });
  f.commit();
  await f.invoke("publish");
  assert.ok(!f.calls.some((call) => call[0] === "npm" && call.includes("private")));
});

test("dist-tag failures can be retried without republishing", async (t) => {
  const f = fixture(t);
  delete f.distTags.latest;
  let fail = true;
  const run: Runner = (command, args) => {
    if (command === "git") return f.git(...args);
    if (command === "npm" && args[0] === "view") {
      return JSON.stringify({ versions: ["1.0.0"], "dist-tags": f.distTags });
    }
    if (command === "npm" && args[0] === "dist-tag") {
      if (fail) throw new Error("Tag update failed");
      f.distTags.latest = "1.0.0";
      return "";
    }
    assert.equal(args[1], "publish-plan");
    writeFileSync(args[args.indexOf("--output") + 1]!, JSON.stringify({ version: 1, plan: [] }));
    return "";
  };
  await assert.rejects(runRelease("publish", { cwd: f.cwd, run, env: {} }), /Tag update failed/);
  fail = false;
  await runRelease("publish", { cwd: f.cwd, run, env: {} });
  assert.equal(f.distTags.latest, "1.0.0");
});
