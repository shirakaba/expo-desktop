// A light fork of the publish-plan portion of @changesets/cli@3.0.1's
// getPublishPlan module.
//
// Every behavioral difference from upstream is enclosed in a FORK block.
// Source: node_modules/@changesets/cli/dist/getPublishPlan.mjs, starting at
// `function getReleaseTag` and ending at `function getPublishPlan`.

import type { Config } from "@changesets/types";
import type { Package as ManyPkgPackage, Packages as ManyPkgPackages } from "@manypkg/tools";

import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import { readPreState } from "@changesets/pre";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { log } from "@clack/prompts";
import { graphSequencer } from "@pnpm/deps.graph-sequencer";
import semverParse from "semver/functions/parse.js";

import { restorePackageName, restoreReleaseName } from "./package-identities.ts";

const cliPackageJsonUrl = import.meta.resolve("@changesets/cli/package.json");

const {
  t: src_default,
}: {
  t: ColorProxy;
} = await import(new URL("./dist/src.mjs", cliPackageJsonUrl).href);
type Color = Extract<Parameters<typeof import("node:util").styleText>[0], string>;
type ColorProxy = Record<Color, (text: string) => string>;

const {
  n: splitByTagStatus,
}: {
  n<T extends { name: string; version: string }>(
    cwd: string,
    tool: ManyPkgPackages["tool"],
    releases: T[],
  ): Promise<{ existing: T[]; untagged: T[] }>;
} = await import(new URL("./dist/gitTags.mjs", cliPackageJsonUrl).href);

type PackageInfoResponse =
  | { error: { code?: string; message?: string } }
  | { published: false }
  | {
      published: true;
      info: { "dist-tags"?: { latest?: string }; versions: string[] };
    };

const {
  r: getPublishTool,
  s: createPromiseQueue,
}: {
  r(packages: ManyPkgPackages): Promise<{
    info(options: { cwd: string; pkg: ManyPkgPackage }): Promise<PackageInfoResponse>;
  }>;
  s(concurrency: number): {
    add<T>(fn: () => Promise<T>): Promise<T>;
  };
} = await import(new URL("./dist/getPublishPlan.mjs", cliPackageJsonUrl).href);

const npmRequestQueue = createPromiseQueue(40);

export type PublishRelease = {
  access: "public" | "restricted";
  kind: "publish";
  name: string;
  tag: string;
  tarball?: { path: string };
  version: string;
};

export type TagOnlyRelease = {
  kind: "tag-only";
  name: string;
  version: string;
};

export type PublishPlanRelease = PublishRelease | TagOnlyRelease;
export type PublishPlan = PublishPlanRelease[][];

function getReleaseTag(
  publishedState: "never" | "only-pre" | "published",
  preState: Awaited<ReturnType<typeof readPreState>>,
  tag: string | undefined,
) {
  if (tag) return tag;
  if (preState != null && publishedState !== "only-pre") return preState.tag;
  return "latest";
}

async function getUnpublishedPackages(
  packages: ManyPkgPackages,
  preState: Awaited<ReturnType<typeof readPreState>>,
  access: Config["access"],
  options: {
    allowPrivatePackages: boolean;
    ignore: readonly string[];
    tag?: string;
  },
  // FORK (start 1)
  packageNamesByVirtualName: ReadonlyMap<string, string>,
  // FORK (end 1)
): Promise<PublishRelease[]> {
  const publishTool = await getPublishTool(packages);
  const results = await Promise.all(
    packages.packages
      .filter(
        (pkg) =>
          !pkg.packageJson.private &&
          !shouldSkipPackage(
            // FORK (start 2)
            restorePackageName(pkg, packageNamesByVirtualName),
            // FORK (end 2)
            options,
          ),
      )
      .map(async (pkg) => {
        // FORK (start 3)
        const actualPkg = restorePackageName(pkg, packageNamesByVirtualName);
        // FORK (end 3)
        const response = await npmRequestQueue.add(() =>
          publishTool.info({
            cwd: packages.rootDir,
            // FORK (start 4)
            pkg: actualPkg,
            // FORK (end 4)
          }),
        );
        if ("error" in response) {
          log.error(
            `
Received an unexpected error for ${src_default.cyan(actualPkg.packageJson.name)}: ${response.error.code || "(no code)"}
${response.error.message || "Unknown error"}
            `.trim(),
          );
          throw new ExitError(1);
        }
        if (!response.published) {
          log.warn(
            `Package ${src_default.cyan(actualPkg.packageJson.name)} was not found in the registry.`,
          );
        }
        let publishedState: "never" | "only-pre" | "published" = "never";
        let publishedVersions = new Array<string>();
        if (response.published) {
          publishedState = "published";
          publishedVersions = response.info.versions;
          if (
            preState != null &&
            response.info["dist-tags"]?.latest &&
            response.info.versions.every(
              (version) => semverParse(version)!.prerelease[0] === preState.tag,
            )
          ) {
            publishedState = "only-pre";
          }
        }
        return {
          pkg,
          publishedState,
          publishedVersions,
        };
      }),
  );
  const packagesToPublish = new Array<PublishRelease>();
  const previewLines = new Array<string>();
  let alreadyPublishedCount = 0;
  for (const result of results) {
    const { pkg, publishedState, publishedVersions } = result;
    const localVersion = pkg.packageJson.version;
    if (!publishedVersions.includes(localVersion)) {
      const release: PublishRelease = {
        kind: "publish",
        name: pkg.packageJson.name,
        version: localVersion,
        access: pkg.packageJson.publishConfig?.access || access,
        tag: getReleaseTag(publishedState, preState, options.tag),
      };
      packagesToPublish.push(release);
      // FORK (start 5)
      const displayRelease = restoreReleaseName(release, packageNamesByVirtualName);
      previewLines.push(
        `${src_default.blue(displayRelease.name)}@${src_default.green(displayRelease.version)}`,
      );
      // FORK (end 5)
      if (preState != null && publishedState === "only-pre") {
        previewLines.push(
          `${src_default.gray("└")} will be published to ${src_default.cyan("latest")} rather than ${src_default.cyan(preState.tag)} as it will be its first published version.`,
        );
      }
    } else {
      alreadyPublishedCount++;
    }
  }
  if (packagesToPublish.length !== 0) {
    log.info(
      `
These packages will be published as they were not found in the registry:
${previewLines.join("\n")}
${src_default.gray(`${alreadyPublishedCount} packages are already published.`)}
      `.trim(),
    );
  }
  return packagesToPublish;
}

async function getUntaggedPrivatePackages(
  cwd: string,
  packages: ManyPkgPackage[],
  tool: ManyPkgPackages["tool"],
  options: { allowPrivatePackages: boolean; ignore: readonly string[] },
  // FORK (start 6)
  packageNamesByVirtualName: ReadonlyMap<string, string>,
  // FORK (end 6)
): Promise<TagOnlyRelease[]> {
  const releases = packages
    .filter(
      (pkg) =>
        pkg.packageJson.private &&
        !shouldSkipPackage(
          // FORK (start 7)
          restorePackageName(pkg, packageNamesByVirtualName),
          // FORK (end 7)
          options,
        ),
    )
    .map((pkg) => ({
      kind: "tag-only" as const,
      name: pkg.packageJson.name,
      version: pkg.packageJson.version,
    }));
  // FORK (start 8)
  // Git tags use real npm names. Translate to real names for tag lookup, then
  // back to the corresponding virtual identity for the internal publish plan.
  const actualReleases = releases.map((release) =>
    restoreReleaseName(release, packageNamesByVirtualName),
  );
  const { untagged } = await splitByTagStatus(cwd, tool, actualReleases);
  const untaggedKeys = new Set(untagged.map(({ name, version }) => `${name}@${version}`));
  return releases.filter((release) => {
    const actual = restoreReleaseName(release, packageNamesByVirtualName);
    return untaggedKeys.has(`${actual.name}@${actual.version}`);
  });
  // FORK (end 8)
}

function sortReleases(
  packages: ManyPkgPackages,
  releases: PublishPlanRelease[],
  opts: Config,
): PublishPlan {
  const dependentsGraph = getDependentsGraph(packages, {
    bumpVersionsWithWorkspaceProtocolOnly: opts.bumpVersionsWithWorkspaceProtocolOnly,
    ignoreDevDependencies: true,
  });
  const releasesByName = new Map(
    releases.map((release) => {
      if (!dependentsGraph.has(release.name)) {
        throw new Error(`Package referenced by release entry not found: ${release.name}`);
      }
      return [release.name, release];
    }),
  );
  const graph = new Map(releases.map((release) => [release, new Array<PublishPlanRelease>()]));
  for (const [dependencyName, dependents] of dependentsGraph) {
    const release = releasesByName.get(dependencyName);
    if (!release) continue;
    for (const dependentName of dependents) {
      const dependentRelease = releasesByName.get(dependentName);
      if (!dependentRelease) continue;
      graph.get(dependentRelease)!.push(release);
    }
  }
  const result = graphSequencer(graph);
  if (result.cycles.length > 0) {
    log.warn(
      `Publish plan contains cyclic dependencies: ${result.cycles.map((cycle) => cycle.map((release) => release.name).join(" -> ")).join("; ")}`,
    );
  }
  return result.chunks;
}

export async function getPublishPlan(
  // FORK (start 9)
  packages: ManyPkgPackages,
  // FORK (end 9)
  config: Config,
  // FORK (start 10)
  packageNamesByVirtualName: ReadonlyMap<string, string>,
  // FORK (end 10)
  options?: { tag?: string },
): Promise<PublishPlan> {
  // FORK (start 11)
  // Upstream accepts rootDir and calls getPackages(rootDir) here. Accepting
  // the already augmented package collection is the package-discovery seam.
  // FORK (end 11)
  const releases = await getUnpublishedPackages(
    packages,
    await readPreState(packages.rootDir),
    config.access,
    {
      tag: options?.tag,
      ignore: config.ignore,
      allowPrivatePackages: config.privatePackages.tag,
    },
    // FORK (start 12)
    packageNamesByVirtualName,
    // FORK (end 12)
  );
  const tagReleases = config.privatePackages.tag
    ? await getUntaggedPrivatePackages(
        packages.rootDir,
        packages.packages,
        packages.tool,
        {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.tag,
        },
        // FORK (start 13)
        packageNamesByVirtualName,
        // FORK (end 13)
      )
    : [];
  if (releases.length === 0 && tagReleases.length === 0) return [];
  return sortReleases(packages, [...releases, ...tagReleases], config);
}
