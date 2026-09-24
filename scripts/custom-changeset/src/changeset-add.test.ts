import type { Package, Packages } from "@manypkg/tools";

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createChangeset,
  getChangedPackages,
  getChangedPackagesSinceRef,
} from "./changeset-add.ts";
import { disambiguatePackages } from "./package-identities.ts";

function packageAt(
  dir: string,
  name: string,
  version: string,
  dependencies?: Record<string, string>,
) {
  return {
    dir,
    relativeDir: dir,
    packageJson: { name, version, dependencies },
  } satisfies Package;
}

function packages(...packages: Package[]) {
  return {
    rootDir: "/repo",
    rootPackage: packageAt("/repo", "root", "1.0.0"),
    packages,
    tool: { type: "pnpm" },
  } as Packages;
}

test("version-qualifies duplicate names without inventing dependency edges", () => {
  const bare54 = packageAt("/repo/bare/54", "bare", "54.81.0");
  const bare55 = packageAt("/repo/bare/55", "bare", "55.82.0");
  const blank54 = packageAt("/repo/blank/54", "blank", "54.81.0", { bare: "~54.81.0" });

  const result = disambiguatePackages(packages(bare54, bare55, blank54));

  assert.deepEqual(
    result.packages.packages.map(({ packageJson }) => packageJson.name),
    ["bare@54.81.0", "bare@55.82.0", "blank"],
  );
  assert.deepEqual(result.packages.packages[2].packageJson.dependencies, {
    bare: "~54.81.0",
  });
  assert.equal(result.packageNamesByDir.get("/repo/bare/54"), "bare@54.81.0");

  // The actual manifests supplied by the caller are never mutated.
  assert.equal(bare54.packageJson.name, "bare");
  assert.deepEqual(blank54.packageJson.dependencies, { bare: "~54.81.0" });
});

test("keeps a selected template version line distinct in changeset frontmatter", async () => {
  const result = disambiguatePackages(
    packages(
      packageAt("/repo/bare/54", "bare", "54.81.0"),
      packageAt("/repo/bare/55", "bare", "55.82.0"),
    ),
    new Set(["/repo/bare/54", "/repo/bare/55"]),
  );

  const changeset = await createChangeset(
    [],
    result.packages.packages,
    result.patchOnlyPackageNames,
    {
      message: "Fix the SDK 54 template",
      patch: ["bare@54.81.0"],
    },
  );

  assert.deepEqual(changeset, {
    summary: "Fix the SDK 54 template",
    releases: [{ name: "bare@54.81.0", type: "patch" }],
  });
});

test("treats every explicitly supplied template as patch-only", () => {
  const result = disambiguatePackages(
    packages(packageAt("/repo/blank/54", "blank", "54.81.0")),
    new Set(["/repo/blank/54"]),
  );

  assert.deepEqual(result.patchOnlyPackageNames, new Set(["blank"]));
});

test("rejects packages that name@version still cannot distinguish", () => {
  assert.throws(
    () =>
      disambiguatePackages(
        packages(
          packageAt("/repo/first", "bare", "54.81.0"),
          packageAt("/repo/second", "bare", "54.81.0"),
        ),
      ),
    /each one must have a different version/,
  );
});

test("detects changes in the assembled package list, including injected templates", async (t) => {
  const rootDir = await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-changeset-add-test-"));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));

  const workspaceDir = path.join(rootDir, "packages/workspace");
  const template54Dir = path.join(rootDir, "templates/bare/54.81");
  const template55Dir = path.join(rootDir, "templates/bare/55.82");
  const packageDirs = [workspaceDir, template54Dir, template55Dir];
  await Promise.all(packageDirs.map((dir) => fs.mkdir(path.join(dir, "src"), { recursive: true })));
  await Promise.all(
    packageDirs.map((dir) => fs.writeFile(path.join(dir, "src/index.js"), "initial\n")),
  );

  execFileSync("git", ["init", "-b", "main"], { cwd: rootDir, stdio: "ignore" });
  execFileSync("git", ["add", "."], { cwd: rootDir, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Changeset Test",
      "-c",
      "user.email=changeset-test@example.com",
      "commit",
      "-m",
      "Initial commit",
    ],
    { cwd: rootDir, stdio: "ignore" },
  );

  await fs.writeFile(path.join(workspaceDir, "src/index.js"), "changed\n");
  await fs.writeFile(path.join(template54Dir, "src/index.js"), "changed\n");

  const result = disambiguatePackages(
    packages(
      packageAt(workspaceDir, "workspace", "1.0.0"),
      packageAt(template54Dir, "template", "54.81.0"),
      packageAt(template55Dir, "template", "55.82.0"),
    ),
  );
  const changedPackages = await getChangedPackagesSinceRef(result.packages.packages, {
    cwd: rootDir,
    ref: "main",
    changedFilePatterns: ["src/**"],
  });

  assert.deepEqual(changedPackages.map(({ packageJson }) => packageJson.name).toSorted(), [
    "template@54.81.0",
    "workspace",
  ]);
});

async function releaseFixture(t: TestContext, specs: Array<[string, string, string]>) {
  const rootDir = await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-release-detection-test-"));
  t.after(() => fs.rm(rootDir, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: rootDir, stdio: "ignore" });
  const write = async (file: string, contents = "changed\n") => {
    const destination = path.join(rootDir, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, contents);
  };
  const commit = () => {
    git("add", ".");
    git("commit", "-m", "fixture");
  };
  git("init", "-b", "main");
  git("config", "user.name", "Changeset Test");
  git("config", "user.email", "changeset-test@example.com");
  const pkgs = specs.map(([dir, name, version]) =>
    packageAt(path.join(rootDir, dir), name, version),
  );
  for (const [dir] of specs) await write(`${dir}/src/index.js`, "initial\n");
  commit();
  return { rootDir, git, write, commit, pkgs };
}

test("detects committed changes on main since each package's own beta release", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["packages/cli", "expo-desktop", "1.0.0-beta.6"],
    ["templates/bare/54.81", "bare", "54.81.1-beta.6"],
    ["templates/blank/54.81", "blank", "54.81.1-beta.5"],
    ["packages/released", "released", "1.1.0"],
    ["packages/unchanged", "unchanged", "1.0.0"],
  ]);
  git("tag", "expo-desktop@1.0.0-beta.5");
  git("tag", "bare@54.81.1-beta.5");
  git("tag", "blank@54.81.1-beta.5");
  git("tag", "released@1.0.0");
  git("tag", "unchanged@1.0.0");

  await write("templates/blank/54.81/src/index.js");
  await write("packages/released/src/index.js");
  commit();
  git("tag", "-a", "expo-desktop@1.0.0-beta.6", "-m", "CLI release");
  git("tag", "bare@54.81.1-beta.6");
  git("tag", "released@1.1.0");

  await write("packages/cli/src/index.js");
  await write("templates/bare/54.81/src/index.js");
  commit();

  assert.deepEqual(await getChangedPackagesSinceRef(pkgs, { cwd: rootDir, ref: "main" }), []);
  const changed = await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main" });
  assert.deepEqual(
    changed.map(({ packageJson }) => packageJson.name),
    ["expo-desktop", "bare", "blank"],
  );
  assert.deepEqual(
    await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main", since: "HEAD" }),
    [],
  );
});

test("finds the latest released version when the manifest has already been bumped", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["packages/cli", "@scope/cli", "1.0.0-beta.11"],
  ]);
  git("tag", "@scope/cli@1.0.0-beta.9");
  await write("packages/cli/src/index.js", "released in beta 10\n");
  commit();
  git("tag", "@scope/cli@1.0.0-beta.10");
  assert.deepEqual(await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main" }), []);

  await write("packages/cli/src/index.js", "unreleased\n");
  commit();
  // Tags above the current manifest version and unrelated tags are not baselines.
  git("tag", "@scope/cli@2.0.0");
  git("tag", "@scope/cli@not-a-version");
  git("tag", "other@1.0.0-beta.11");
  assert.deepEqual(await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main" }), pkgs);
});

test("uses real npm names and independent major.minor lines for templates", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["templates/bare/54.81", "bare", "54.81.2-beta.0"],
    ["templates/bare/54.82", "bare", "54.82.1-beta.0"],
    ["templates/blank/54.81", "blank", "54.81.2-beta.0"],
  ]);
  git("tag", "bare@54.81.1-beta.0");
  // Only a different version line has been released for this blank template.
  git("tag", "blank@53.80.0");
  await write("templates/bare/54.81/src/index.js");
  await write("templates/blank/54.81/src/index.js");
  commit();
  git("tag", "bare@54.82.1-beta.0");

  const {
    packages: identified,
    packageNamesByVirtualName,
    patchOnlyPackageNames,
  } = disambiguatePackages(packages(...pkgs), new Set(pkgs.map(({ dir }) => dir)));
  const changed = await getChangedPackages(identified.packages, {
    cwd: rootDir,
    baseBranch: "main",
    packageNamesByVirtualName,
    patchOnlyPackageNames,
  });
  assert.deepEqual(
    changed.map(({ packageJson }) => packageJson.name),
    ["bare@54.81.2-beta.0"],
  );
});

test("ignores release tags on branches that have not been merged", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["packages/cli", "cli", "1.0.0-beta.2"],
  ]);
  git("tag", "cli@1.0.0-beta.1");
  await write("packages/cli/src/index.js");
  commit();
  git("checkout", "-b", "other-release");
  await write("packages/cli/src/index.js", "other branch\n");
  commit();
  git("tag", "cli@1.0.0-beta.2");
  git("checkout", "main");
  assert.deepEqual(await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main" }), pkgs);
});

test("preserves file patterns, deletions, uncommitted edits, and nested package ownership", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["packages/parent", "parent", "1.0.0"],
    ["packages/parent/child", "child", "1.0.0"],
    ["packages/deleted", "deleted", "1.0.0"],
    ["packages/staged", "staged", "1.0.0"],
  ]);
  git("tag", "parent@1.0.0");
  await write("packages/parent/child/src/index.js", "released child change\n");
  commit();
  for (const name of ["child", "deleted", "staged"]) git("tag", `${name}@1.0.0`);

  await write("packages/parent/src/ignored.js", "ignored\n");
  await write("packages/staged/src/index.js");
  git("add", ".");
  await write("packages/parent/child/src/index.js", "uncommitted child change\n");
  await fs.rm(path.join(rootDir, "packages/deleted/src/index.js"));
  const changed = await getChangedPackages(pkgs, {
    cwd: rootDir,
    baseBranch: "main",
    changedFilePatterns: ["src/**", "!src/ignored.js"],
  });
  assert.deepEqual(
    changed.map(({ packageJson }) => packageJson.name),
    ["child", "deleted", "staged"],
  );
});

test("falls back to the configured base branch when a package has no release tags", async (t) => {
  const { rootDir, pkgs, git, write, commit } = await releaseFixture(t, [
    ["packages/new", "new", "1.0.0"],
  ]);
  git("checkout", "-b", "feature");
  await write("packages/new/src/index.js");
  commit();
  assert.deepEqual(await getChangedPackages(pkgs, { cwd: rootDir, baseBranch: "main" }), pkgs);
});
