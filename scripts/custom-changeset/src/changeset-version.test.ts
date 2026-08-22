import type { Package } from "@manypkg/tools";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { version } from "./changeset-version.ts";
import { getTemplatePackages } from "./template-packages.ts";
import { writeTemplateFixtures } from "./test-fixtures.ts";

test("versions all selected name@version template identities", async () => {
  await using fixture = await createFixture(`---
"expo-desktop-template-bare-minimum@54.81.0": patch
"expo-desktop-template-bare-minimum@55.82.0": patch
"expo-desktop-template-blank-typescript@54.81.0": patch
"expo-desktop-template-blank-typescript@55.82.0": patch
---

Patch every maintained template line.
`);

  await version({ cwd: fixture.rootDir, extraPackages: fixture.templates });

  const bare54 = await readTemplate(fixture.rootDir, "bare-minimum/54.81");
  const bare55 = await readTemplate(fixture.rootDir, "bare-minimum/55.82");
  const blank54 = await readTemplate(fixture.rootDir, "blank-typescript/54.81");
  const blank55 = await readTemplate(fixture.rootDir, "blank-typescript/55.82");

  assert.equal(bare54.name, "expo-desktop-template-bare-minimum");
  assert.equal(bare54.version, "54.81.1");
  assert.equal(bare55.name, "expo-desktop-template-bare-minimum");
  assert.equal(bare55.version, "55.82.1");
  assert.equal(blank54.name, "expo-desktop-template-blank-typescript");
  assert.equal(blank54.version, "54.81.1");
  assert.equal(blank55.name, "expo-desktop-template-blank-typescript");
  assert.equal(blank55.version, "55.82.1");

  // Template dependency propagation is deliberately outside the fork. These
  // old patch ranges already accept the newly versioned bare templates.
  assert.equal(blank54.dependencies["expo-desktop-template-bare-minimum"], "~54.81.0");
  assert.equal(blank55.dependencies["expo-desktop-template-bare-minimum"], "~55.82.0");

  const bare54Changelog = await fs.readFile(
    path.join(fixture.rootDir, "templates/bare-minimum/54.81/CHANGELOG.md"),
    "utf8",
  );
  assert.match(bare54Changelog, /^# expo-desktop-template-bare-minimum$/m);
  assert.doesNotMatch(bare54Changelog, /bare-minimum@54\.81\.0/);
  await assert.rejects(fs.access(path.join(fixture.rootDir, ".changeset/template-fix.md")));
});

test("versions only the selected template version line", async () => {
  await using fixture = await createFixture(`---
"expo-desktop-template-bare-minimum@54.81.0": patch
---

Patch only SDK 54.
`);

  await version({ cwd: fixture.rootDir, extraPackages: fixture.templates });

  assert.equal((await readTemplate(fixture.rootDir, "bare-minimum/54.81")).version, "54.81.1");
  assert.equal((await readTemplate(fixture.rootDir, "bare-minimum/55.82")).version, "55.82.0");
  assert.equal((await readTemplate(fixture.rootDir, "blank-typescript/54.81")).version, "54.81.0");
  assert.equal((await readTemplate(fixture.rootDir, "blank-typescript/55.82")).version, "55.82.0");
});

async function createFixture(changeset: string) {
  const rootDir = await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-version-test-"));
  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, version: "1.0.0" }, undefined, 2)}\n`,
  );
  await fs.writeFile(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  await fs.mkdir(path.join(rootDir, "packages/normal"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "packages/normal/package.json"),
    `${JSON.stringify({ name: "normal", version: "1.0.0" }, undefined, 2)}\n`,
  );
  await fs.mkdir(path.join(rootDir, ".changeset"));
  await fs.writeFile(
    path.join(rootDir, ".changeset/config.json"),
    `${JSON.stringify(
      {
        access: "public",
        baseBranch: "main",
        changelog: "@changesets/cli/changelog",
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
  await fs.writeFile(path.join(rootDir, ".changeset/template-fix.md"), changeset);

  await writeTemplateFixtures(rootDir);
  const templates = await getTemplatePackages(rootDir);

  return {
    rootDir,
    templates,
    async [Symbol.asyncDispose]() {
      await fs.rm(rootDir, { force: true, recursive: true });
    },
  } satisfies { rootDir: string; templates: Package[] } & AsyncDisposable;
}

async function readTemplate(rootDir: string, relativeDir: string) {
  return JSON.parse(
    await fs.readFile(path.join(rootDir, "templates", relativeDir, "package.json"), "utf8"),
  );
}
