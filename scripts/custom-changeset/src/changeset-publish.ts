// A light fork of @changesets/cli@3.0.1's publish command.
//
// Every behavioral difference from upstream is enclosed in a FORK block.
// Source: node_modules/@changesets/cli/dist/publish.mjs.

import type { Config, Packages } from "@changesets/types";
import type { Package as ManyPkgPackage, Packages as ManyPkgPackages } from "@manypkg/tools";

import { ExitError } from "@changesets/errors";
import { readPreState } from "@changesets/pre";
import { log, progress, spinner } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import path, { resolve } from "node:path";

// FORK (start 1)
import {
  getPublishPlan,
  type PublishPlan,
  type PublishRelease,
  type TagOnlyRelease,
} from "./changeset-publish-plan.ts";
import {
  disambiguatePackages,
  restorePackageName,
  restoreReleaseName,
} from "./package-identities.ts";
// FORK (end 1)

const cliPackageJsonUrl = import.meta.resolve("@changesets/cli/package.json");

const {
  a: isPublishSuccessful,
  i: isPublishFailure,
  n: readPlanFile,
  o: npmPublishQueue,
  r: getPublishTool,
}: {
  a(result: PublishResult): boolean;
  i(result: PublishResult): boolean;
  n(filePath: string): Promise<PublishPlan>;
  o: { add<T>(fn: () => Promise<T>): Promise<T> };
  r(packages: ManyPkgPackages): Promise<PublishTool>;
} = await import(new URL("./dist/getPublishPlan.mjs", cliPackageJsonUrl).href);

const {
  t: src_default,
}: {
  t: ColorProxy;
} = await import(new URL("./dist/src.mjs", cliPackageJsonUrl).href);
type Color = Extract<Parameters<typeof import("node:util").styleText>[0], string>;
type ColorProxy = Record<Color, (text: string) => string>;

const {
  a: importantWarning,
}: {
  a(message: string): void;
} = await import(new URL("./dist/cli-utilities.mjs", cliPackageJsonUrl).href);

const {
  t: readConfig,
}: {
  t(packages: Packages): Promise<Config>;
} = await import(new URL("./dist/read-config.mjs", cliPackageJsonUrl).href);

const {
  t: ensureChangesetFolder,
}: {
  t(rootDir: string): Promise<void>;
} = await import(new URL("./dist/shared.mjs", cliPackageJsonUrl).href);

const {
  i: createOutputReport,
  n: createGitTags,
  r: formatGitTagResults,
  t: _usingCtx,
}: {
  i(output?: string): Promise<OutputReporter | undefined>;
  n(options: {
    packages: ManyPkgPackages;
    releases: TagOnlyRelease[];
    reporter?: OutputReporter;
  }): Promise<{ existing: TagOnlyRelease[]; tagged: TagOnlyRelease[] }>;
  r(
    tool: ManyPkgPackages["tool"],
    results: { existing: TagOnlyRelease[]; tagged: TagOnlyRelease[] },
  ): string;
  t(): UsingContext;
} = await import(new URL("./dist/usingCtx.mjs", cliPackageJsonUrl).href);

// FORK (start 2)
export type GitTagOutputEvent = {
  packageName: string;
  tag: string;
  type: "git-tag";
};

export type ExtraPackageGitTag = {
  event: GitTagOutputEvent;
  pkg: ManyPkgPackage;
};
// FORK (end 2)

export type PublishOptions = {
  cwd?: string;
  fromPackDir?: string;
  gitTag?: boolean;
  otp?: string;
  output?: string;
  tag?: string;
  // FORK (start 3)
  /** Packages intentionally excluded from the monorepo workspace config. */
  extraPackages?: ManyPkgPackage[];
  /** Handle extra-package tags without exposing them to Changesets Action workspace lookup. */
  onExtraPackageGitTag?: (tag: ExtraPackageGitTag) => void;
  // FORK (end 3)
};

type OutputReporter = AsyncDisposable & {
  write(event: Record<string, unknown>): void;
};

type UsingContext = {
  a<T>(value: T): T;
  d(): Promise<void>;
  e?: unknown;
};

// FORK (start 4)
function isGitTagOutputEvent(event: Record<string, unknown>): event is GitTagOutputEvent {
  return (
    event.type === "git-tag" &&
    typeof event.tag === "string" &&
    typeof event.packageName === "string"
  );
}

function getExtraPackagesByGitTag(extraPackages: readonly ManyPkgPackage[]) {
  const packagesByGitTag = new Map<string, ManyPkgPackage>();
  for (const pkg of extraPackages) {
    const tag = `${pkg.packageJson.name}@${pkg.packageJson.version}`;
    if (packagesByGitTag.has(tag)) {
      throw new Error(`Cannot report multiple extra packages with the same git tag: ${tag}.`);
    }
    packagesByGitTag.set(tag, pkg);
  }
  return packagesByGitTag;
}

function routeOutputReporter(
  reporter: OutputReporter | undefined,
  extraPackagesByGitTag: ReadonlyMap<string, ManyPkgPackage>,
  onExtraPackageGitTag: PublishOptions["onExtraPackageGitTag"],
): OutputReporter | undefined {
  if (onExtraPackageGitTag == null) return reporter;

  return {
    write(event) {
      if (isGitTagOutputEvent(event)) {
        const pkg = extraPackagesByGitTag.get(event.tag);
        if (pkg != null) {
          onExtraPackageGitTag({ event, pkg });
          return;
        }
      }
      reporter?.write(event);
    },
    async [Symbol.asyncDispose]() {},
  };
}
// FORK (end 4)

export type PublishResult = {
  code?: string;
  message?: string;
  name: string;
  result: "published" | "failed" | "failed:already-published" | "failed:needs-2fa";
  version: string;
};

export type PublishTool = {
  getOtpCode(otp?: string): string | null;
  publish(options: {
    interactive: boolean;
    otpCode: string | null;
    pkg: ManyPkgPackage;
    release: PublishRelease;
    tarballPath: string | null;
  }): Promise<PublishResult>;
};

export type PublishQueueItem = {
  release: PublishRelease;
  result: PublishResult | undefined;
};

function formatPackageList(
  entry: Array<{ name: string; version: string } | PublishResult>,
  versionColor = src_default.green,
) {
  return entry
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const error =
        "result" in entry && isPublishFailure(entry)
          ? `\n${src_default.dim(`└`)} ${entry.code || "(no code)"}: ${entry.message || "Unknown error"}`
          : "";
      return `${src_default.blueBright(entry.name)}@${versionColor(entry.version)}${error}`;
    })
    .join("\n");
}

function showNonLatestTagWarning(
  tag: string | undefined,
  preState: Awaited<ReturnType<typeof readPreState>>,
) {
  if (preState) {
    importantWarning(`
You are in prerelease mode, so packages will be published to the ${src_default.cyan(preState.tag)} npm tag,
${src_default.red("except")} for packages that have not had normal releases, which will be published to ${src_default.cyan("latest")}.
      `);
  } else if (tag !== "latest") {
    log.warn(`Packages will be released under the ${tag} tag.`);
  }
}

export async function bulkPublishPackages({
  publishTool,
  publishQueue,
  packagesByName,
  artifactDir,
  otpCode,
  onResult,
  // FORK (start 5)
  packageNamesByVirtualName,
  // FORK (end 5)
}: {
  artifactDir: string | undefined;
  onResult?: (result: PublishResult) => void;
  otpCode: string | null;
  packagesByName: ReadonlyMap<string, ManyPkgPackage>;
  publishQueue: PublishQueueItem[];
  publishTool: PublishTool;
  // FORK (start 6)
  packageNamesByVirtualName: ReadonlyMap<string, string>;
  // FORK (end 6)
}) {
  if (publishQueue.length === 0) return [];
  const publishPromises = publishQueue.map(async (item) => {
    // FORK (start 7)
    const pkg = restorePackageName(
      packagesByName.get(item.release.name)!,
      packageNamesByVirtualName,
    );
    const release = restoreReleaseName(item.release, packageNamesByVirtualName);
    // FORK (end 7)
    const result = await npmPublishQueue.add(() =>
      publishTool.publish({
        pkg,
        // FORK (start 8)
        release,
        // FORK (end 8)
        tarballPath: artifactDir ? resolve(artifactDir, item.release.tarball!.path) : null,
        interactive: false,
        otpCode,
      }),
    );
    onResult?.(result);
    return {
      release: item.release,
      result,
    };
  });
  return Promise.all(publishPromises);
}

export async function publish(options?: PublishOptions): Promise<void> {
  var _usingCtx$1: UsingContext = null!;
  try {
    _usingCtx$1 = _usingCtx();
    const reporter = _usingCtx$1.a(await createOutputReport(options?.output));
    const cwd = options?.cwd ?? process.cwd();
    const artifactDir = options?.fromPackDir ? path.resolve(cwd, options.fromPackDir) : undefined;
    // FORK (start 9)
    const discoveredPackages = await getPackages(cwd);
    discoveredPackages.packages.push(...(options?.extraPackages ?? []));
    const { packageNamesByVirtualName, packages } = disambiguatePackages(discoveredPackages);
    const extraPackagesByGitTag = getExtraPackagesByGitTag(options?.extraPackages ?? []);
    const publishReporter = routeOutputReporter(
      reporter,
      extraPackagesByGitTag,
      options?.onExtraPackageGitTag,
    );
    // FORK (end 9)
    const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));
    const publishTool = await getPublishTool(packages);
    await ensureChangesetFolder(packages.rootDir);
    const releaseTag = options?.tag && options.tag.length > 0 ? options.tag : undefined;
    const preState = !artifactDir ? await readPreState(packages.rootDir) : undefined;
    if (artifactDir && releaseTag) {
      log.error("Releasing under custom tag is not allowed in artifact mode.");
      throw new ExitError(1);
    }
    if (releaseTag && preState && preState.mode === "pre") {
      log.error(
        `
Releasing under custom tag is not allowed in pre mode!
To resolve this exit the pre mode by running ${src_default.cyan("changeset pre exit")}.
      `.trim(),
      );
      throw new ExitError(1);
    }
    if (releaseTag || preState) showNonLatestTagWarning(options?.tag, preState);
    const config = await readConfig(packages);
    // FORK (start 10)
    if (artifactDir && options?.extraPackages?.length) {
      throw new Error(
        "Publishing extra packages from a Changesets pack directory is not supported.",
      );
    }
    const plan = artifactDir
      ? await readPlanFile(path.join(artifactDir, "publish-plan.json"))
      : await getPublishPlan(packages, config, packageNamesByVirtualName, {
          tag: releaseTag,
        });
    // FORK (end 10)
    if (plan.length === 0) {
      log.warn("No unpublished projects to publish.");
      return;
    }
    let finishedCount = 0;
    const successfulNpmPublishes = new Array<PublishResult>();
    const unsuccessfulNpmPublishes = new Array<PublishResult>();
    const totalPublishCount = plan.reduce(
      (count, chunk) => count + chunk.filter((release) => release.kind === "publish").length,
      0,
    );
    const gitTagReleases = new Array<TagOnlyRelease>();
    const tagOnlyReleases = new Set<TagOnlyRelease>();
    let otpCode = publishTool.getOtpCode(options?.otp);
    let sequential = Boolean(process.stdin.isTTY && otpCode == null);
    const p = progress({ max: totalPublishCount });
    const renderProgressMessage = () =>
      finishedCount === 0
        ? "Publishing packages"
        : `Publishing packages (${finishedCount}/${totalPublishCount})`;
    const advanceProgress = () => {
      finishedCount++;
      p.advance(1, renderProgressMessage());
    };
    publishChunks: for (const chunk of plan) {
      let publishQueue = new Array<PublishQueueItem>();
      for (const release of chunk) {
        if (release.kind === "tag-only") {
          if (options?.gitTag ?? true) {
            // FORK (start 11)
            const actualRelease = restoreReleaseName(release, packageNamesByVirtualName);
            gitTagReleases.push(actualRelease);
            tagOnlyReleases.add(actualRelease);
            // FORK (end 11)
          }
          continue;
        }
        publishQueue.push({
          release,
          result: undefined,
        });
      }
      while (publishQueue.length > 0) {
        if (sequential) {
          const item = publishQueue.shift()!;
          let interactive = false;
          // FORK (start 12)
          const pkg = restorePackageName(
            packagesByName.get(item.release.name)!,
            packageNamesByVirtualName,
          );
          const release = restoreReleaseName(item.release, packageNamesByVirtualName);
          // FORK (end 12)
          let result =
            item.result ??
            (await npmPublishQueue.add(() =>
              publishTool.publish({
                pkg,
                // FORK (start 13)
                release,
                // FORK (end 13)
                tarballPath: artifactDir
                  ? path.resolve(artifactDir, item.release.tarball!.path)
                  : null,
                interactive,
                otpCode,
              }),
            ));
          while (result.result === "failed:needs-2fa") {
            otpCode = null;
            p.stop(`${src_default.blue(release.name)} requires 2FA verification to publish...`);
            if (totalPublishCount >= 2) {
              importantWarning(
                src_default.italic(
                  `
Make sure to check the "skip 2fa for 5 minutes" option to not have to do this
for every package being published after this!
                `.trim(),
                ),
              );
            }
            interactive = true;
            result = await npmPublishQueue.add(() =>
              publishTool.publish({
                pkg,
                // FORK (start 14)
                release,
                // FORK (end 14)
                tarballPath: artifactDir
                  ? path.resolve(artifactDir, item.release.tarball!.path)
                  : null,
                interactive,
                otpCode: null,
              }),
            );
          }
          advanceProgress();
          if (result.result === "failed:already-published") {
            if (finishedCount === totalPublishCount) p.clear();
            else if (interactive) p.start(renderProgressMessage());
            continue;
          }
          if (isPublishSuccessful(result)) {
            successfulNpmPublishes.push(result);
            if (!interactive) sequential = false;
            else if (finishedCount < totalPublishCount) p.start(renderProgressMessage());
          }
          if (isPublishFailure(result)) {
            p.clear();
            unsuccessfulNpmPublishes.push(result);
            break publishChunks;
          }
          continue;
        }
        const publishedItems = await bulkPublishPackages({
          publishTool,
          publishQueue,
          packagesByName,
          otpCode,
          artifactDir,
          onResult: (result) => {
            if (process.stdin.isTTY && result.result === "failed:needs-2fa") return;
            advanceProgress();
          },
          // FORK (start 15)
          packageNamesByVirtualName,
          // FORK (end 15)
        });
        const results = publishedItems.map((item) => item.result);
        const successes = results.filter(isPublishSuccessful);
        successfulNpmPublishes.push(...successes);
        const failures = results.filter((result) => result.result === "failed");
        unsuccessfulNpmPublishes.push(...failures);
        const recoverableItems = publishedItems.filter(
          (item) => item.result.result === "failed:needs-2fa",
        );
        if (failures.length > 0 || !process.stdin.isTTY) {
          unsuccessfulNpmPublishes.push(...recoverableItems.map((item) => item.result));
          publishQueue = [];
          if (failures.length > 0 || recoverableItems.length > 0) break publishChunks;
          continue;
        }
        publishQueue = recoverableItems.map((item, index) => ({
          release: item.release,
          result: index === 0 ? item.result : undefined,
        }));
        if (publishQueue.length > 0) {
          sequential = true;
          otpCode = null;
        }
      }
    }
    if (successfulNpmPublishes.length !== 0) {
      const message = `Successfully published:\n${formatPackageList(successfulNpmPublishes)}`;
      if (sequential) log.success(message);
      else p.stop(message);
      if (options?.gitTag ?? true) {
        gitTagReleases.push(
          ...successfulNpmPublishes.map((result) => ({
            kind: "tag-only" as const,
            ...result,
          })),
        );
      }
    } else {
      p.clear();
    }
    if (unsuccessfulNpmPublishes.length !== 0) {
      log.error(
        `
Some packages failed to publish:
${formatPackageList(unsuccessfulNpmPublishes, src_default.red)}
      `.trim(),
      );
    }
    if (gitTagReleases.length > 0) {
      const p = spinner();
      p.start("Creating git tags...");
      const results = await createGitTags({
        packages,
        releases: gitTagReleases,
        // FORK (start 16)
        reporter: publishReporter,
        // FORK (end 16)
      });
      p.stop(
        formatGitTagResults(packages.tool, {
          tagged: results.tagged.filter((release) => tagOnlyReleases.has(release)),
          existing: results.existing,
        }),
      );
    }
    if (unsuccessfulNpmPublishes.length !== 0) throw new ExitError(1);
  } catch (_) {
    _usingCtx$1.e = _;
  } finally {
    await _usingCtx$1.d();
  }
}
