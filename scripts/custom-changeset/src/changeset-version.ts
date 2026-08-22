// A light fork of @changesets/cli@3.0.1's version command.
//
// Every behavioral difference from upstream is enclosed in a FORK block.
// Source: https://github.com/changesets/changesets/blob/bed458124f623463c581521ab56d040eba2a8b20/packages/cli/src/commands/version/index.ts

import type { CommitFunctions, Config, Packages } from "@changesets/types";
import type { Package as ManyPkgPackage } from "@manypkg/tools";

import { applyReleasePlan } from "@changesets/apply-release-plan";
import { assembleReleasePlan } from "@changesets/assemble-release-plan";
import { ExitError } from "@changesets/errors";
import { getDependentsGraph } from "@changesets/get-dependents-graph";
import * as git from "@changesets/git";
import { readPreState } from "@changesets/pre";
import { readChangesets } from "@changesets/read";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
// FORK (start 1)
import fs from "node:fs/promises";
// FORK (end 1)
import path from "node:path";
import { fileURLToPath } from "node:url";

// FORK (start 2)
import { disambiguatePackages } from "./package-identities.ts";
// FORK (end 2)

const cliPackageJsonUrl = import.meta.resolve("@changesets/cli/package.json");

const {
  t: ensureChangesetFolder,
}: {
  t(rootDir: string): Promise<void>;
} = await import(new URL("./dist/shared.mjs", cliPackageJsonUrl).href);

const {
  t: readConfig,
}: {
  t(packages: Packages): Promise<Config>;
} = await import(new URL("./dist/read-config.mjs", cliPackageJsonUrl).href);

const {
  t: getCommitFunctions,
}: {
  t(
    commit: Config["commit"],
    cwd: string,
    contextDir: string,
  ): Promise<[CommitFunctions, null | Record<string, unknown>]>;
} = await import(new URL("./dist/getCommitFunctions.mjs", cliPackageJsonUrl).href);

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

export type VersionOptions = {
  cwd?: string;
  ignore?: string[];
  snapshot?: boolean | string;
  snapshotPrereleaseTemplate?: string;
  // FORK (start 3)
  /** Packages intentionally excluded from the monorepo workspace config. */
  extraPackages?: ManyPkgPackage[];
  // FORK (end 3)
};

export async function version(options: VersionOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  // FORK (start 4)
  const discoveredPackages = await getPackages(cwd);
  discoveredPackages.packages.push(...(options.extraPackages ?? []));

  // Changesets keys its release plan by package name. Only duplicate package
  // names receive an in-memory `name@version` identity; package.json files on
  // disk retain their real npm names.
  const { packageNamesByVirtualName, packages } = disambiguatePackages(discoveredPackages);
  // FORK (end 4)
  await ensureChangesetFolder(packages.rootDir);
  const config = await readConfig(packages);
  const messages = new Array<string>();
  let ignore: string[] | undefined;
  if (options.ignore != null) {
    if (config.ignore.length > 0) {
      messages.push(
        "It looks like you are trying to use the `--ignore` option while ignore is defined in the config file. This is currently not allowed, you can only use one of them at a time.",
      );
    } else {
      ignore = options.ignore;
    }
  }
  const releaseConfig = {
    ...config,
    ignore: ignore ?? config.ignore,
    snapshot: {
      ...config.snapshot,
      prereleaseTemplate: options.snapshotPrereleaseTemplate ?? config.snapshot.prereleaseTemplate,
    },
    commit: options.snapshot ? false : config.commit,
  };
  validateIgnoredPackageNames(packages, options.ignore, messages);
  validateSkippedDependents(packages, releaseConfig, messages);
  if (messages.length > 0) {
    log.error(messages.join("\n"));
    throw new ExitError(1);
  }
  const [changesets, preState] = await Promise.all([readChangesets(cwd), readPreState(cwd)]);
  if (preState?.mode === "pre") {
    if (options.snapshot != null) {
      log.error(
        `
Snapshot release is not allowed in pre mode.
To resolve this exit the pre mode by running ${src_default.cyan("changeset pre exit")}.
        `.trim(),
      );
      throw new ExitError(1);
    } else {
      importantWarning(`
You are in prerelease mode!
If you meant to do a normal release you should revert these changes and run ${src_default.cyan("changeset pre exit")}.
You can then run ${src_default.cyan("changeset version")} again to do a normal release.
        `);
    }
  }
  if (changesets.length === 0 && (preState == null || preState.mode !== "exit")) {
    log.warn("No unreleased changesets found.");
    throw new ExitError(1);
  }
  const releasePlan = assembleReleasePlan(
    changesets,
    packages,
    releaseConfig,
    preState,
    options.snapshot
      ? {
          tag: options.snapshot === true ? undefined : options.snapshot,
          commit: ["{commit}", "{commit-short}"].some((placeholder) =>
            releaseConfig.snapshot.prereleaseTemplate?.includes(placeholder),
          )
            ? await git.getCurrentCommitId({ cwd })
            : undefined,
        }
      : undefined,
  );
  const contextDir = path.dirname(fileURLToPath(import.meta.url));
  const [...touchedFiles] = await applyReleasePlan(
    releasePlan,
    packages,
    releaseConfig,
    options.snapshot,
    contextDir,
  );
  // FORK (start 5)
  // applyReleasePlan uses the in-memory identity as a new changelog heading.
  // Restore only that heading; package manifests were never renamed on disk.
  await restoreChangelogHeadings(touchedFiles, packageNamesByVirtualName);
  // FORK (end 5)
  const [{ getVersionMessage }, commitOpts] = await getCommitFunctions(
    releaseConfig.commit,
    cwd,
    contextDir,
  );
  if (getVersionMessage) {
    let touchedFile: string | undefined;
    while ((touchedFile = touchedFiles.shift())) {
      await git.add(path.relative(cwd, touchedFile), cwd);
    }
    if (!(await git.commit(await getVersionMessage(releasePlan, commitOpts), cwd))) {
      log.error("Changesets ran into trouble committing your files");
    } else {
      log.success("All files have been updated and committed. You're ready to publish!");
    }
  } else {
    log.success("All files have been updated. Review them and commit at your leisure");
  }
}

function validateIgnoredPackageNames(
  packages: Packages,
  ignoreFromCli: string[] | undefined,
  messages: string[],
) {
  if (!ignoreFromCli) return;
  const pkgNames = new Set(packages.packages.map(({ packageJson }) => packageJson.name));
  for (const pkgName of ignoreFromCli) {
    if (pkgNames.has(pkgName)) continue;
    messages.push(
      `The package ${src_default.blue(pkgName)} is passed to the \`--ignore\` option but it is not found in the project. You may have misspelled the package name.`,
    );
  }
}

function validateSkippedDependents(packages: Packages, config: Config, messages: string[]) {
  const packagesByName = new Map(packages.packages.map((pkg) => [pkg.packageJson.name, pkg]));
  const dependentsGraph = getDependentsGraph(packages, {
    ignoreDevDependencies: true,
    bumpVersionsWithWorkspaceProtocolOnly: config.bumpVersionsWithWorkspaceProtocolOnly,
  });
  for (const pkg of packages.packages) {
    if (
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      })
    ) {
      continue;
    }
    const skippedPackage = pkg.packageJson.name;
    const dependents = dependentsGraph.get(skippedPackage) || [];
    for (const dependent of dependents) {
      const dependentPkg = packagesByName.get(dependent)!;
      if (dependentPkg.packageJson.private) continue;
      if (
        !shouldSkipPackage(dependentPkg, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.version,
        })
      ) {
        messages.push(
          `The package ${src_default.blue(dependent)} depends on the skipped package ${src_default.blue(skippedPackage)} (either by \`ignore\` option or by \`privatePackages.version\`), but ${src_default.blue(dependent)} is not being skipped. Please pass ${src_default.blue(dependent)} to the ${src_default.cyan("--ignore")} flag.`,
        );
      }
    }
  }
}

// FORK (start 6)
async function restoreChangelogHeadings(
  touchedFiles: string[],
  packageNamesByVirtualName: ReadonlyMap<string, string>,
): Promise<void> {
  for (const touchedFile of touchedFiles) {
    if (path.basename(touchedFile) !== "CHANGELOG.md") continue;
    const contents = await fs.readFile(touchedFile, "utf8");
    const firstLineEnd = contents.search(/\r?\n/);
    const firstLine = firstLineEnd === -1 ? contents : contents.slice(0, firstLineEnd);
    if (!firstLine.startsWith("# ")) continue;

    const virtualName = firstLine.slice(2);
    const packageName = packageNamesByVirtualName.get(virtualName);
    if (!packageName || packageName === virtualName) continue;
    await fs.writeFile(touchedFile, `# ${packageName}${contents.slice(firstLine.length)}`);
  }
}
// FORK (end 6)
