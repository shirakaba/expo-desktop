import semver from "semver";

import type { Runner } from "./release.ts";

type PackageVersion = { name: string; version: string };
export type TagUpdate = PackageVersion & { tag: string; previous?: string; published: boolean };
const registry = "--registry=https://registry.npmjs.org/";

export function getPackageTag(
  name: string,
  branchTag: string,
  independentPackages: string[],
): string {
  return independentPackages.includes(name) ? "latest" : branchTag;
}

// This is separate from Changesets' publication plan: existing versions can need new tags.
export function getTagUpdates(
  packages: PackageVersion[],
  unpublished: Set<string>,
  tagFor: (name: string) => string,
  run: Runner,
): TagUpdate[] {
  const updates: TagUpdate[] = [];
  for (const { name, version } of packages) {
    const tag = tagFor(name);
    if (!semver.valid(version)) throw new Error(`Invalid version for ${name}: ${version}`);
    if (tag === "latest" && semver.prerelease(version)) {
      throw new Error(`Cannot release ${name}@${version} to latest. Use a stable version.`);
    }
    let info: { versions?: string | string[]; "dist-tags"?: Record<string, string> };
    try {
      info = JSON.parse(
        run(
          "npm",
          ["view", name, "versions", "dist-tags", "--json", "--prefer-online", registry],
          true,
        ),
      );
    } catch (error) {
      let code: string | undefined;
      try {
        code = JSON.parse((error as { stdout?: string }).stdout ?? "{}").error?.code;
      } catch {
        /* Registry/authentication failures must not be mistaken for new packages. */
      }
      if (code !== "E404") throw error;
      info = {};
    }
    const published = [info.versions ?? []].flat().includes(version);
    // Only Changesets decides which missing versions are eligible for publication.
    if (!published && !unpublished.has(name)) continue;
    const previous = info["dist-tags"]?.[tag];
    if (previous === version) continue;
    if (previous && !semver.gt(version, previous)) {
      if (!published) {
        throw new Error(
          `Publishing ${name}@${version} would move ${tag} backwards from ${previous}. Reconcile this branch's source and version first.`,
        );
      }
      console.log(`Keep ${name}@${tag} at ${previous}; this checkout has ${version}.`);
      continue;
    }
    updates.push({ name, version, tag, previous, published });
  }
  return updates;
}

export function syncTags(updates: TagUpdate[], run: Runner): void {
  // New versions receive their tag through Changesets publishing; only promote existing artifacts.
  for (const { name, version, tag, published } of updates) {
    if (published) run("npm", ["dist-tag", "add", `${name}@${version}`, tag, registry]);
  }
}
