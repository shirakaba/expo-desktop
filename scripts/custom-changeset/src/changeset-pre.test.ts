import type { Config } from "@changesets/types";
import type { Package } from "@manypkg/tools";

import { getPackages } from "@manypkg/get-packages";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pre } from "./changeset-pre.ts";
import { getPublishPlan } from "./changeset-publish-plan.ts";
import { version } from "./changeset-version.ts";
import { disambiguatePackages } from "./package-identities.ts";
import { getTemplatePackages } from "./template-packages.ts";
import { writeTemplateFixtures } from "./test-fixtures.ts";

test("versions regular packages and tuple templates through a beta lifecycle", async () => {
  await using fixture = await createFixture(`---
"regular": minor
"expo-desktop-template-bare-minimum@54.81.0": patch
"expo-desktop-template-bare-minimum@55.82.0": patch
"expo-desktop-template-blank-typescript@54.81.0": patch
"expo-desktop-template-blank-typescript@55.82.0": patch
---

Release a beta.
`);

  await pre({
    command: "enter",
    cwd: fixture.rootDir,
    extraPackages: fixture.templates,
    tag: "beta",
  });
  assert.deepEqual(await readJson(path.join(fixture.rootDir, ".changeset/pre.json")), {
    mode: "pre",
    tag: "beta",
  });

  await version({ cwd: fixture.rootDir, extraPackages: fixture.templates });

  assert.equal((await readPackage(fixture.rootDir, "packages/regular")).version, "1.1.0-beta.0");
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/bare-minimum/54.81")).version,
    "54.81.1-beta.0",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/bare-minimum/55.82")).version,
    "55.82.1-beta.0",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/blank-typescript/54.81")).version,
    "54.81.1-beta.0",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/blank-typescript/55.82")).version,
    "55.82.1-beta.0",
  );
  await fs.access(path.join(fixture.rootDir, ".changeset/pre/beta-release.md"));

  const prereleaseTemplates = await getTemplatePackages(fixture.rootDir);
  const discoveredPackages = await getPackages(fixture.rootDir);
  discoveredPackages.packages.push(...prereleaseTemplates);
  const { packageNamesByVirtualName, packages } = disambiguatePackages(discoveredPackages);

  const oldPath = process.env.PATH;
  process.env.PATH = `${fixture.binDir}${path.delimiter}${oldPath ?? ""}`;
  try {
    const plan = await getPublishPlan(packages, config, packageNamesByVirtualName);
    const releases = plan.flat().filter((release) => release.kind === "publish");
    assert.equal(releases.length, 5);
    assert.ok(releases.every((release) => release.tag === "beta"));
    assert.deepEqual(releases.map(({ name }) => name).toSorted(), [
      "expo-desktop-template-bare-minimum@54.81.1-beta.0",
      "expo-desktop-template-bare-minimum@55.82.1-beta.0",
      "expo-desktop-template-blank-typescript@54.81.1-beta.0",
      "expo-desktop-template-blank-typescript@55.82.1-beta.0",
      "regular",
    ]);
  } finally {
    process.env.PATH = oldPath;
  }

  await pre({ command: "exit", cwd: fixture.rootDir, extraPackages: prereleaseTemplates });
  assert.deepEqual(await readJson(path.join(fixture.rootDir, ".changeset/pre.json")), {
    mode: "exit",
    tag: "beta",
  });

  await version({ cwd: fixture.rootDir, extraPackages: prereleaseTemplates });

  assert.equal((await readPackage(fixture.rootDir, "packages/regular")).version, "1.1.0");
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/bare-minimum/54.81")).version,
    "54.81.1",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/bare-minimum/55.82")).version,
    "55.82.1",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/blank-typescript/54.81")).version,
    "54.81.1",
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/blank-typescript/55.82")).version,
    "55.82.1",
  );
  await assert.rejects(fs.access(path.join(fixture.rootDir, ".changeset/pre.json")));
  await assert.rejects(fs.access(path.join(fixture.rootDir, ".changeset/pre/beta-release.md")));
});

test("rejects a non-patch template bump in prerelease mode", async () => {
  await using fixture = await createFixture(`---
"expo-desktop-template-bare-minimum@54.81.0": minor
---

Invalid template beta.
`);

  await pre({
    command: "enter",
    cwd: fixture.rootDir,
    extraPackages: fixture.templates,
    tag: "beta",
  });

  await assert.rejects(
    version({ cwd: fixture.rootDir, extraPackages: fixture.templates }),
    /process exited with code: 1/i,
  );
  assert.equal(
    (await readPackage(fixture.rootDir, "templates/bare-minimum/54.81")).version,
    "54.81.0",
  );
});

const config = {
  access: "public",
  baseBranch: "main",
  bumpVersionsWithWorkspaceProtocolOnly: false,
  changedFilePatterns: ["**"],
  changelog: false,
  commit: false,
  fixed: [],
  format: false,
  ignore: [],
  linked: [],
  privatePackages: { tag: false, version: false },
  snapshot: { prereleaseTemplate: null, useCalculatedVersion: false },
  updateInternalDependencies: "patch",
  ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
    onlyUpdatePeerDependentsWhenOutOfRange: false,
    updateInternalDependents: "out-of-range",
  },
} satisfies Config;

async function createFixture(changeset: string) {
  const rootDir = await fs.realpath(
    await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-pre-test-")),
  );
  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, version: "1.0.0" }, undefined, 2)}\n`,
  );
  await fs.writeFile(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  await fs.mkdir(path.join(rootDir, "packages/regular"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "packages/regular/package.json"),
    `${JSON.stringify({ name: "regular", version: "1.0.0" }, undefined, 2)}\n`,
  );
  await fs.mkdir(path.join(rootDir, ".changeset"));
  await fs.writeFile(
    path.join(rootDir, ".changeset/config.json"),
    `${JSON.stringify(
      {
        access: "public",
        baseBranch: "main",
        changelog: false,
        commit: false,
        fixed: [],
        format: false,
        ignore: [],
        linked: [],
        updateInternalDependencies: "patch",
      },
      undefined,
      2,
    )}\n`,
  );
  await fs.writeFile(path.join(rootDir, ".changeset/beta-release.md"), changeset);
  await writeTemplateFixtures(rootDir);

  const binDir = path.join(rootDir, "bin");
  await fs.mkdir(binDir);
  const fakePnpmPath = path.join(binDir, "pnpm");
  await fs.writeFile(
    fakePnpmPath,
    `#!/usr/bin/env node
const command = process.argv[2];
if (command === "info") {
  console.log(JSON.stringify({ name: process.argv[3], versions: [], "dist-tags": {} }));
} else {
  process.exitCode = 1;
}
`,
  );
  await fs.chmod(fakePnpmPath, 0o755);

  const templates = await getTemplatePackages(rootDir);
  return {
    binDir,
    rootDir,
    templates,
    async [Symbol.asyncDispose]() {
      await fs.rm(rootDir, { force: true, recursive: true });
    },
  } satisfies AsyncDisposable & { binDir: string; rootDir: string; templates: Package[] };
}

async function readPackage(rootDir: string, relativeDir: string) {
  return readJson(path.join(rootDir, relativeDir, "package.json"));
}

async function readJson(filePath: string) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}
