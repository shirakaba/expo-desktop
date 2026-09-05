import type { Package, Packages } from "@manypkg/tools";

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createChangeset, getChangedPackagesSinceRef } from "./changeset-add.ts";
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
