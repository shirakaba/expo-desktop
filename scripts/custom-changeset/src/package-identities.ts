import type { Package as ManyPkgPackage, Packages as ManyPkgPackages } from "@manypkg/tools";

import path from "node:path";

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
