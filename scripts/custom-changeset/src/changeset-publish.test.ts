import type { Config } from "@changesets/types";
import type { Packages } from "@manypkg/tools";

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { getPublishPlan } from "./changeset-publish-plan.ts";
import {
  bulkPublishPackages,
  publish,
  type PublishQueueItem,
  type PublishTool,
} from "./changeset-publish.ts";
import { disambiguatePackages } from "./package-identities.ts";
import { getTemplatePackages } from "./template-packages.ts";
import { writeTemplateFixtures } from "./test-fixtures.ts";

test("builds one publish-plan entry per tuple while querying real npm names", async () => {
  await using fixture = await fakeRegistryFixture();
  await writeTemplateFixtures(fixture.rootDir);
  const templates = await getTemplatePackages(fixture.rootDir);
  const discoveredPackages = {
    rootDir: fixture.rootDir,
    packages: templates,
    rootPackage: {
      dir: fixture.rootDir,
      packageJson: { name: "fixture", private: true, version: "1.0.0" },
      relativeDir: ".",
    },
    tool: { type: "pnpm" },
  } as unknown as Packages;
  const { packageNamesByVirtualName, packages } = disambiguatePackages(discoveredPackages);

  const oldPath = process.env.PATH;
  process.env.PATH = `${fixture.binDir}${path.delimiter}${oldPath ?? ""}`;
  try {
    const plan = await getPublishPlan(packages, config, packageNamesByVirtualName);

    assert.deepEqual(
      plan
        .flat()
        .map(({ name }) => name)
        .toSorted(),
      [
        "expo-desktop-template-bare-minimum@54.81.0",
        "expo-desktop-template-bare-minimum@55.82.0",
        "expo-desktop-template-blank-typescript@54.81.0",
        "expo-desktop-template-blank-typescript@55.82.0",
      ],
    );
    assert.deepEqual((await fs.readFile(fixture.logPath, "utf8")).trim().split("\n").toSorted(), [
      "info:expo-desktop-template-bare-minimum",
      "info:expo-desktop-template-bare-minimum",
      "info:expo-desktop-template-blank-typescript",
      "info:expo-desktop-template-blank-typescript",
    ]);
  } finally {
    process.env.PATH = oldPath;
  }
});

test("runs the complete forked publish flow for every tuple without contacting npm", async () => {
  await using fixture = await fakeRegistryFixture();
  await writePublishFixture(fixture.rootDir);
  const templates = await getTemplatePackages(fixture.rootDir);

  const oldPath = process.env.PATH;
  process.env.PATH = `${fixture.binDir}${path.delimiter}${oldPath ?? ""}`;
  try {
    await publish({ cwd: fixture.rootDir, extraPackages: templates, gitTag: false });

    const publishCalls = (await fs.readFile(fixture.logPath, "utf8"))
      .trim()
      .split("\n")
      .filter((line) => line.startsWith("publish:"))
      .toSorted();
    assert.deepEqual(publishCalls, [
      "publish:expo-desktop-template-bare-minimum@54.81.0:templates/bare-minimum/54.81",
      "publish:expo-desktop-template-bare-minimum@55.82.0:templates/bare-minimum/55.82",
      "publish:expo-desktop-template-blank-typescript@54.81.0:templates/blank-typescript/54.81",
      "publish:expo-desktop-template-blank-typescript@55.82.0:templates/blank-typescript/55.82",
    ]);
  } finally {
    process.env.PATH = oldPath;
  }
});

test("resolves each virtual publish-plan identity to its actual package and npm name", async () => {
  await using fixture = await fakeRegistryFixture();
  const rootDir = fixture.rootDir;
  await writeTemplateFixtures(rootDir);
  const templates = await getTemplatePackages(rootDir);
  const discoveredPackages = {
    rootDir,
    packages: templates,
    tool: { type: "pnpm" },
  } as unknown as Packages;
  const { packageNamesByVirtualName, packages } = disambiguatePackages(discoveredPackages);
  const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));
  const publishQueue: PublishQueueItem[] = packages.packages.map((pkg) => ({
    release: {
      access: "public",
      kind: "publish",
      name: pkg.packageJson.name,
      tag: "latest",
      version: pkg.packageJson.version,
    },
    result: undefined,
  }));
  const calls = new Array<string>();
  const publishTool: PublishTool = {
    getOtpCode: () => null,
    publish: async ({ pkg, release }) => {
      calls.push(`${pkg.relativeDir}:${pkg.packageJson.name}:${release.name}@${release.version}`);
      return { name: release.name, result: "published", version: release.version };
    },
  };

  const results = await bulkPublishPackages({
    artifactDir: undefined,
    otpCode: null,
    packagesByName,
    packageNamesByVirtualName,
    publishQueue,
    publishTool,
  });

  assert.deepEqual(
    calls.toSorted(),
    [
      "templates/bare-minimum/54.81:expo-desktop-template-bare-minimum:expo-desktop-template-bare-minimum@54.81.0",
      "templates/blank-typescript/54.81:expo-desktop-template-blank-typescript:expo-desktop-template-blank-typescript@54.81.0",
      "templates/bare-minimum/55.82:expo-desktop-template-bare-minimum:expo-desktop-template-bare-minimum@55.82.0",
      "templates/blank-typescript/55.82:expo-desktop-template-blank-typescript:expo-desktop-template-blank-typescript@55.82.0",
    ].toSorted(),
  );
  assert.deepEqual(
    results
      .map(({ release, result }) => [release.name, result.name] as const)
      .toSorted(([a], [b]) => a.localeCompare(b)),
    [
      ["expo-desktop-template-bare-minimum@54.81.0", "expo-desktop-template-bare-minimum"],
      ["expo-desktop-template-blank-typescript@54.81.0", "expo-desktop-template-blank-typescript"],
      ["expo-desktop-template-bare-minimum@55.82.0", "expo-desktop-template-bare-minimum"],
      ["expo-desktop-template-blank-typescript@55.82.0", "expo-desktop-template-blank-typescript"],
    ].toSorted(([a], [b]) => a.localeCompare(b)),
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

async function fakeRegistryFixture() {
  const rootDir = await fs.realpath(
    await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-publish-test-")),
  );
  const binDir = path.join(rootDir, "bin");
  const logPath = path.join(rootDir, "registry-queries.txt");
  await fs.mkdir(binDir);
  const fakePnpmPath = path.join(binDir, "pnpm");
  await fs.writeFile(
    fakePnpmPath,
    `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const logPath = ${JSON.stringify(logPath)};
const rootDir = ${JSON.stringify(rootDir)};
const command = process.argv[2];
if (command === "info") {
  fs.appendFileSync(logPath, "info:" + process.argv[3] + "\\n");
  console.log(JSON.stringify({ name: process.argv[3], versions: [], "dist-tags": {} }));
} else if (command === "publish") {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
  const relativeDir = path.relative(rootDir, process.cwd());
  fs.appendFileSync(logPath, "publish:" + pkg.name + "@" + pkg.version + ":" + relativeDir + "\\n");
  console.log("{}");
} else {
  process.exitCode = 1;
}
`,
  );
  await fs.chmod(fakePnpmPath, 0o755);

  return {
    binDir,
    logPath,
    rootDir,
    async [Symbol.asyncDispose]() {
      await fs.rm(rootDir, { force: true, recursive: true });
    },
  } satisfies AsyncDisposable & { binDir: string; logPath: string; rootDir: string };
}

async function writePublishFixture(rootDir: string) {
  await fs.writeFile(
    path.join(rootDir, "package.json"),
    `${JSON.stringify({ name: "fixture", private: true, version: "1.0.0" }, undefined, 2)}\n`,
  );
  await fs.writeFile(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
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
  await writeTemplateFixtures(rootDir);
}
