import type { NewChangeset } from "@changesets/types";
import type { Package as ManyPkgPackage, Packages as ManyPkgPackages } from "@manypkg/tools";

import path from "node:path";
import semverParse from "semver/functions/parse.js";

/**
 * Changesets uses package names as identities. For the only unsupported case
 * in this repository -- side-by-side template packages with the same npm name
 * -- use `name@currentVersion` as the in-memory identity.
 *
 * Dependency names deliberately remain untouched. Changesets therefore treats
 * dependencies between these virtual packages as external dependencies. This
 * keeps versioning simple and means versioning a bare template does not
 * automatically version or rewrite its blank-template dependent.
 */
export function disambiguatePackages(
  input: ManyPkgPackages,
  patchOnlyPackageDirs: ReadonlySet<string> = new Set(),
): {
  packageNamesByDir: ReadonlyMap<string, string>;
  packageNamesByVirtualName: ReadonlyMap<string, string>;
  packages: ManyPkgPackages;
  patchOnlyPackageNames: ReadonlySet<string>;
} {
  const packagesByName = Map.groupBy(input.packages, ({ packageJson }) => packageJson.name);
  const duplicateNames = new Set(
    packagesByName
      .entries()
      .filter(([, packages]) => packages.length > 1)
      .map(([name]) => name),
  );
  const packageNamesByDir = new Map<string, string>();
  const packageNamesByVirtualName = new Map<string, string>();
  const patchOnlyPackageNames = new Set<string>();

  for (const name of duplicateNames) {
    const packages = packagesByName.get(name)!;
    const identities = new Set(
      packages.map(({ packageJson }) => `${packageJson.name}@${packageJson.version}`),
    );
    if (identities.size !== packages.length) {
      throw new Error(
        `Cannot distinguish side-by-side packages named ${name}: each one must have a different version.`,
      );
    }
  }

  const disambiguatePackage = (pkg: ManyPkgPackage): ManyPkgPackage => {
    const originalName = pkg.packageJson.name;
    const virtualName = duplicateNames.has(originalName)
      ? `${originalName}@${pkg.packageJson.version}`
      : originalName;
    const resolvedDir = path.resolve(pkg.dir);

    packageNamesByDir.set(resolvedDir, virtualName);
    packageNamesByVirtualName.set(virtualName, originalName);
    if (patchOnlyPackageDirs.has(resolvedDir)) patchOnlyPackageNames.add(virtualName);

    return virtualName === originalName
      ? pkg
      : {
          ...pkg,
          packageJson: {
            ...pkg.packageJson,
            name: virtualName,
          },
        };
  };

  return {
    packageNamesByDir,
    packageNamesByVirtualName,
    packages: {
      ...input,
      packages: input.packages.map(disambiguatePackage),
    },
    patchOnlyPackageNames,
  };
}

/** Restore a virtual identity before passing a package to npm/pnpm/yarn. */
export function restorePackageName(
  pkg: ManyPkgPackage,
  packageNamesByVirtualName: ReadonlyMap<string, string>,
): ManyPkgPackage {
  const packageName = packageNamesByVirtualName.get(pkg.packageJson.name);
  if (!packageName || packageName === pkg.packageJson.name) return pkg;
  return {
    ...pkg,
    packageJson: {
      ...pkg.packageJson,
      name: packageName,
    },
  };
}

/** Restore a virtual identity in user-facing publish results and git tags. */
export function restoreReleaseName<T extends { name: string }>(
  release: T,
  packageNamesByVirtualName: ReadonlyMap<string, string>,
): T {
  const packageName = packageNamesByVirtualName.get(release.name);
  return packageName && packageName !== release.name ? { ...release, name: packageName } : release;
}

/**
 * Changesets keeps applied changesets while in prerelease mode. A template's
 * virtual identity changes when its version does, so point retained release
 * entries at the current identity for the same template version line.
 */
export function rebasePrereleaseChangesetPackageNames(
  changesets: NewChangeset[],
  extraPackages: readonly ManyPkgPackage[],
  packageNamesByDir: ReadonlyMap<string, string>,
): NewChangeset[] {
  const currentPackageNames = new Set(packageNamesByDir.values());
  const currentNamesByLine = new Map<string, string>();
  const actualPackageNames = new Set<string>();

  for (const pkg of extraPackages) {
    const version = semverParse(pkg.packageJson.version);
    if (version == null) {
      throw new Error(
        `Cannot identify the template version line for ${pkg.packageJson.name}@${pkg.packageJson.version}.`,
      );
    }
    const currentName = packageNamesByDir.get(path.resolve(pkg.dir));
    if (currentName == null) continue;

    const line = templateVersionLine(pkg.packageJson.name, version.major, version.minor);
    const existingName = currentNamesByLine.get(line);
    if (existingName != null && existingName !== currentName) {
      throw new Error(
        `Cannot distinguish side-by-side packages on the ${pkg.packageJson.name}@${version.major}.${version.minor} version line.`,
      );
    }
    actualPackageNames.add(pkg.packageJson.name);
    currentNamesByLine.set(line, currentName);
  }

  return changesets.map((changeset) => {
    if (!changeset.id.startsWith("pre/")) return changeset;
    return {
      ...changeset,
      releases: changeset.releases.map((release) => {
        if (currentPackageNames.has(release.name)) return release;

        for (const actualPackageName of actualPackageNames) {
          const prefix = `${actualPackageName}@`;
          if (!release.name.startsWith(prefix)) continue;

          const version = semverParse(release.name.slice(prefix.length));
          if (version == null) continue;
          const currentName = currentNamesByLine.get(
            templateVersionLine(actualPackageName, version.major, version.minor),
          );
          if (currentName != null) return { ...release, name: currentName };
        }
        return release;
      }),
    };
  });
}

function templateVersionLine(name: string, major: number, minor: number): string {
  return `${name}\0${major}\0${minor}`;
}
