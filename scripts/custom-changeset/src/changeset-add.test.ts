import type { Package, Packages } from "@manypkg/tools";

import assert from "node:assert/strict";
import test from "node:test";

import { createChangeset } from "./changeset-add.ts";
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
