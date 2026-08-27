// A light fork of @changesets/cli@3.0.1's add command.
//
// Every behavioral difference from upstream is enclosed in a FORK block.
// https://github.com/changesets/changesets/blob/bed458124f623463c581521ab56d040eba2a8b20/packages/cli/src/commands/add/index.ts#L30

import type {
  CommitFunctions,
  Config,
  Package,
  PackageJSON,
  Packages,
  Release,
  VersionType,
} from "@changesets/types";
import type { Package as ManyPkgPackage } from "@manypkg/tools";

import { ExitError, InternalError } from "@changesets/errors";
import * as git from "@changesets/git";
import { shouldSkipPackage } from "@changesets/should-skip-package";
import { writeChangeset } from "@changesets/write";
import {
  confirm,
  type GroupMultiSelectOptions,
  isCancel,
  log,
  note,
  type Option,
} from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import launchEditor from "launch-editor";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import semverLt from "semver/functions/lt.js";

// FORK (start 3)
import { disambiguatePackages } from "./package-identities.ts";
// FORK (end 3)

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
  t: src_default,
}: {
  t: ColorProxy;
} = await import(new URL("./dist/src.mjs", cliPackageJsonUrl).href);
type Color = Extract<Parameters<typeof import("node:util").styleText>[0], string>;
type ColorProxy = Record<Color, (text: string) => string>;

const {
  t: getVersionableChangedPackages,
}: {
  t(
    config: Config,
    {
      cwd,
      ref,
    }: {
      cwd: string;
      ref?: string;
    },
  ): Promise<Array<Package>>;
} = await import(new URL("./dist/versionablePackages.mjs", cliPackageJsonUrl).href);

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
  a: importantWarning,
  i: askQuestion,
  n: askList,
  r: askMultiselect,
  t: askConfirm,
}: {
  a(message: string): void;
  i(message: string, { placeholder, notEmpty }: QuestionOptions): Promise<string>;
  n<Value extends string>(message: string, choices: Value[] | Option<Value>[]): Promise<Value>;
  r<Value>(
    message: string,
    values: MultiselectOptions<Value>,
    options?: Omit<GroupMultiSelectOptions<Value>, "message" | "options">,
  ): Promise<Value[]>;
  t(message: string, initialValue?: boolean): Promise<boolean>;
} = await import(new URL("./dist/cli-utilities.mjs", cliPackageJsonUrl).href);
type QuestionOptions = {
  placeholder?: string;
  notEmpty?: boolean;
};
type MultiselectOptions<Value> = Record<string, Option<Value>[]>;

export async function add(options: {
  /**
   * Support specifying extra packages beyond the ones picked up by
   * getPackages(). We need this for picking up our templates (which are not
   * workspaces in the monorepo, because we don't actually want to install the
   * dependencies for them).
   */
  // FORK (start 1)
  extraPackages?: Array<ManyPkgPackage>;
  // FORK (end 1)
  cwd?: string;
  empty?: boolean;
  open?: boolean;
  since?: string;
  message?: string;
  major?: Array<string>;
  minor?: Array<string>;
  patch?: Array<string>;
}): Promise<void> {
  const discoveredPackages = await getPackages(options?.cwd ?? process.cwd());
  // FORK (start 2)
  if (options.extraPackages?.length) {
    discoveredPackages.packages.push(...options.extraPackages);
  }
  // FORK (end 2)
  // FORK (start 5)
  // Changesets uses package names as map keys everywhere, including while it
  // validates the dependency graph. Give duplicate template lines a virtual,
  // version-qualified name before any Changesets code sees them.
  const { packageNamesByDir, packages, patchOnlyPackageNames } = disambiguatePackages(
    discoveredPackages,
    new Set(options.extraPackages?.map(({ dir }) => path.resolve(dir))),
  );
  // FORK (end 5)
  await ensureChangesetFolder(packages.rootDir);
  if (packages.packages.length === 0) {
    log.error(
      `No packages found. You might have ${packages.tool.type} workspaces configured but no packages yet?`,
    );
    throw new ExitError(1);
  }
  const config = await readConfig(packages);
  const versionablePackages = packages.packages.filter(
    (pkg) =>
      !shouldSkipPackage(pkg, {
        ignore: config.ignore,
        allowPrivatePackages: config.privatePackages.version,
      }),
  );
  if (versionablePackages.length === 0) {
    log.error(
      `
  No versionable packages found
    ${src_default.italic("Ensure the packages to version are not ignored by the config")}
    ${src_default.italic("Ensure that relevant package.json files have a `version` field")}
  `.trim(),
    );
    throw new ExitError(1);
  }
  const changesetBase = path.resolve(packages.rootDir, ".changeset");
  let newChangeset;
  if (options?.empty)
    newChangeset = {
      releases: [],
      summary: options?.message ?? "",
    };
  else {
    let changedPackagesNames = new Array<string>();
    try {
      changedPackagesNames = (
        await getVersionableChangedPackages(config, {
          cwd: packages.rootDir,
          ref: options?.since,
        })
      ).map(
        (pkg) =>
          // FORK (start 6)
          packageNamesByDir.get(path.resolve(pkg.dir)) ?? pkg.packageJson.name,
        // FORK (end 6)
      );
    } catch (error) {
      log.warn(
        `
  Failed to identify which packages have changed since the ${options?.since ? "ref" : "base branch"} due to an error:
  ${(error as Error).toString()}
  `.trim(),
      );
    }
    newChangeset = await createChangeset(
      changedPackagesNames,
      versionablePackages,
      patchOnlyPackageNames,
      {
        message: options?.message,
        major: options?.major,
        minor: options?.minor,
        patch: options?.patch,
      },
    );
    printConfirmationMessage(newChangeset, versionablePackages.length > 1);
  }
  const changesetID = await writeChangeset(newChangeset, packages.rootDir, config);
  const [{ getAddMessage }, commitOpts] = await getCommitFunctions(
    config.commit,
    packages.rootDir,
    path.dirname(fileURLToPath(import.meta.url)),
  );
  const finalLogMessageLines = [];
  if (getAddMessage) {
    await git.add(path.resolve(changesetBase, `${changesetID}.md`), packages.rootDir);
    await git.commit(await getAddMessage(newChangeset, commitOpts), packages.rootDir);
    finalLogMessageLines.push(
      src_default.green(`${options?.empty ? "Empty " : ""}Changeset added and committed!`),
    );
  } else
    finalLogMessageLines.push(
      src_default.green(
        `${options?.empty ? "Empty " : ""}Changeset added - you can now commit it!`,
      ),
    );
  if ([...newChangeset.releases].find((c) => c.type === "major"))
    importantWarning(`
  This Changeset includes a major change and we STRONGLY recommend adding more information to the changeset:
    WHAT the breaking change is
    WHY the change was made
    HOW a consumer should update their code
          `);
  else
    finalLogMessageLines.push(
      src_default.green(
        "If you want to modify or expand on the changeset summary, you can find it here:",
      ),
    );
  const changesetPath = path.relative(process.cwd(), path.join(changesetBase, `${changesetID}.md`));
  finalLogMessageLines.push(src_default.blue(changesetPath));
  log.success(finalLogMessageLines.join("\n"));
  if (options?.open) launchEditor(changesetPath);
}

function printConfirmationMessage(
  changeset: {
    releases: Array<Release>;
    summary: string;
  },
  repoHasMultiplePackages: boolean,
) {
  function getReleasesOfType(type: VersionType) {
    return changeset.releases
      .filter((release) => release.type === type)
      .map((release) => release.name);
  }
  const majorReleases = getReleasesOfType("major");
  const minorReleases = getReleasesOfType("minor");
  const patchReleases = getReleasesOfType("patch");
  let msg = src_default.bold("Summary of changesets:");
  if (majorReleases.length > 0)
    msg += `\n${src_default.bold(src_default.red("major"))}:  ${majorReleases.join(", ")}`;
  if (minorReleases.length > 0)
    msg += `\n${src_default.bold(src_default.green("minor"))}:  ${minorReleases.join(", ")}`;
  if (patchReleases.length > 0)
    msg += `\n${src_default.bold(src_default.blue("patch"))}:  ${patchReleases.join(", ")}`;
  log.success(msg);
  if (repoHasMultiplePackages)
    note(
      `All packages that depend on these whose required versions will be incompatible will also be ${src_default.blue("patch")} bumped when this changeset is applied.`,
      "NOTE",
    );
}

export async function createChangeset(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
  // FORK (start 7)
  patchOnlyPackageNames: ReadonlySet<string>,
  // FORK (end 7)
  optionsFromCli?: OptionsFromCli,
): Promise<{ summary: string; releases: Array<Release> }> {
  const releases = new Array<Release>();
  if (optionsFromCli?.major || optionsFromCli?.minor || optionsFromCli?.patch) {
    const pkgNames = new Set(allPackages.map(({ packageJson }) => packageJson.name));
    const messages = new Array<string>();
    validateSelectedPackageNames(pkgNames, optionsFromCli, messages);
    validateDuplicatePackageNames(pkgNames, optionsFromCli, messages);
    // FORK (start 8)
    validatePatchOnlyPackageBumps(patchOnlyPackageNames, optionsFromCli, messages);
    // FORK (end 8)
    if (messages.length > 0) {
      log.error(messages.join("\n"));
      throw new ExitError(1);
    }
    for (const [type, packageNamesFromCli] of [
      ["major", optionsFromCli?.major] as const,
      ["minor", optionsFromCli?.minor] as const,
      ["patch", optionsFromCli?.patch] as const,
    ])
      for (const pkgName of packageNamesFromCli ?? [])
        releases.push({
          name: pkgName,
          type,
        });
  } else if (allPackages.length > 1) {
    const packagesToRelease = await getPackagesToRelease(changedPackages, allPackages);
    packagesToRelease.sort((a, b) => a.localeCompare(b));
    const pkgJsonsByName = getPkgJsonsByName(allPackages);
    const pkgsLeftToGetBumpTypeFor = new Set(packagesToRelease);
    // FORK (start 9)
    // A template identity describes one maintained template line. Major/minor
    // bumps would move it into another line, so do not offer those release
    // types for templates.
    const packagesThatCanHaveNonPatchBumps = packagesToRelease.filter(
      (pkgName) => !patchOnlyPackageNames.has(pkgName),
    );
    const pkgsThatShouldBeMajorBumped =
      packagesThatCanHaveNonPatchBumps.length === 0
        ? []
        : await askMultiselect(
            src_default.bold(
              `Which packages should have a ${src_default.red("major")} ${src_default.gray(`(${src_default.red("X")}.X.X)`)} bump?`,
            ),
            {
              "all packages": packagesThatCanHaveNonPatchBumps.map((pkgName) => ({
                label: formatPkgNameAndVersion(
                  pkgName,
                  pkgJsonsByName.get(pkgName)!.version,
                  patchOnlyPackageNames,
                ),
                value: pkgName,
              })),
            },
          );
    // FORK (end 9)
    for (const pkgName of pkgsThatShouldBeMajorBumped)
      if (await confirmMajorRelease(pkgJsonsByName.get(pkgName)!)) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);
        releases.push({
          name: pkgName,
          type: "major",
        });
      }
    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      // FORK (start 10)
      const packagesThatCanHaveMinorBumps = Array.from(pkgsLeftToGetBumpTypeFor).filter(
        (pkgName) => !patchOnlyPackageNames.has(pkgName),
      );
      const pkgsThatShouldBeMinorBumped =
        packagesThatCanHaveMinorBumps.length === 0
          ? []
          : await askMultiselect(
              src_default.bold(
                `Which packages should have a ${src_default.green("minor")} ${src_default.gray(`(X.${src_default.green("X")}.X)`)} bump?`,
              ),
              {
                "all packages": packagesThatCanHaveMinorBumps.map((pkgName) => ({
                  label: formatPkgNameAndVersion(
                    pkgName,
                    pkgJsonsByName.get(pkgName)!.version,
                    patchOnlyPackageNames,
                  ),
                  value: pkgName,
                })),
              },
            );
      // FORK (end 10)
      for (const pkgName of pkgsThatShouldBeMinorBumped) {
        pkgsLeftToGetBumpTypeFor.delete(pkgName);
        releases.push({
          name: pkgName,
          type: "minor",
        });
      }
    }
    if (pkgsLeftToGetBumpTypeFor.size !== 0) {
      const patchBumpedPackages = Array.from(pkgsLeftToGetBumpTypeFor, (pkgName) =>
        formatPkgNameAndVersion(
          pkgName,
          pkgJsonsByName.get(pkgName)!.version,
          patchOnlyPackageNames,
        ),
      );
      log.info(
        `
The following packages will be ${src_default.blue("patch")} ${src_default.gray(`(X.X.${src_default.blue("X")})`)} bumped:
${src_default.gray(patchBumpedPackages.join(", "))}
        `.trim(),
      );
      for (const pkgName of pkgsLeftToGetBumpTypeFor)
        releases.push({
          name: pkgName,
          type: "patch",
        });
    }
  } else {
    const pkg = allPackages[0];
    // FORK (start 11)
    const type = patchOnlyPackageNames.has(pkg.packageJson.name)
      ? "patch"
      : await askList<VersionType>(
          `What kind of change is this for ${src_default.blue(pkg.packageJson.name)}? ${src_default.gray(`(current version is ${pkg.packageJson.version})`)}`,
          [
            {
              value: "patch",
              label: `patch ${src_default.gray(`(X.X.${src_default.blue("X")})`)}`,
            },
            {
              value: "minor",
              label: `minor ${src_default.gray(`(X.${src_default.green("X")}.X)`)}`,
            },
            {
              value: "major",
              label: `major ${src_default.gray(`(${src_default.red("X")}.X.X)`)}`,
            },
          ],
        );
    // FORK (end 11)
    if (type === "major") {
      if (!(await confirmMajorRelease(pkg.packageJson))) throw new ExitError(1);
    }
    releases.push({
      name: pkg.packageJson.name,
      type,
    });
  }
  if (optionsFromCli?.message != null)
    return {
      summary: optionsFromCli.message,
      releases,
    };
  let summary = await askQuestion(
    "Please enter a summary for this change (this will be in the changelogs).",
    { placeholder: "  (submit nothing to open an external editor)" },
  );
  if (summary.length === 0) {
    try {
      summary = await askWithEditor(
        "\n\n# Please enter a summary for your changes.\n# An empty message aborts the editor.",
      );
      if (summary.length > 0)
        return {
          summary,
          releases,
        };
    } catch {
      summary = await askQuestion(
        `${src_default.red("An error happened using external editor. Please type your summary here:")}`,
        { notEmpty: true },
      );
    }
    summary ||= await askQuestion("Did not find a summary in the edited file. Please enter one:", {
      notEmpty: true,
    });
  }
  return {
    summary,
    releases,
  };
}
type OptionsFromCli = {
  message?: string;
  major?: string[];
  minor?: string[];
  patch?: string[];
};
function validateSelectedPackageNames(
  pkgNames: Set<string>,
  optionsFromCli: OptionsFromCli | undefined,
  messages: string[],
) {
  for (const [flag, packageNamesFromCli] of [
    ["--major", optionsFromCli?.major],
    ["--minor", optionsFromCli?.minor],
    ["--patch", optionsFromCli?.patch],
  ])
    for (const pkgName of packageNamesFromCli ?? []) {
      if (pkgNames.has(pkgName)) continue;
      messages.push(
        `The package ${src_default.blue(pkgName)} is passed to the \`${flag}\` option but it is not found in the project. You may have misspelled the package name.`,
      );
    }
}
function validateDuplicatePackageNames(
  pkgNames: Set<string>,
  optionsFromCli: OptionsFromCli | undefined,
  messages: string[],
) {
  const major = new Set(optionsFromCli?.major).intersection(pkgNames);
  const minor = new Set(optionsFromCli?.minor).intersection(pkgNames);
  const patch = new Set(optionsFromCli?.patch).intersection(pkgNames);
  const duplicates = major
    .intersection(minor)
    .union(major.intersection(patch))
    .union(minor.intersection(patch));
  for (const pkgName of duplicates) {
    const flags = [
      major.has(pkgName) && "--major",
      minor.has(pkgName) && "--minor",
      patch.has(pkgName) && "--patch",
    ].filter((flag) => flag !== false);
    messages.push(
      `The package ${src_default.blue(pkgName)} is passed to multiple release type options: ${flags.map((flag) => `\`${flag}\``).join(", ")}. Please select only one release type for this package.`,
    );
  }
}
// FORK (start 12)
function validatePatchOnlyPackageBumps(
  patchOnlyPackageNames: ReadonlySet<string>,
  optionsFromCli: OptionsFromCli | undefined,
  messages: string[],
) {
  for (const [flag, packageNamesFromCli] of [
    ["--major", optionsFromCli?.major],
    ["--minor", optionsFromCli?.minor],
  ])
    for (const pkgName of packageNamesFromCli ?? []) {
      if (!patchOnlyPackageNames.has(pkgName)) continue;
      messages.push(
        `The template ${src_default.blue(pkgName)} is passed to the \`${flag}\` option, but side-by-side template versions may only receive patch bumps. Pass it to \`--patch\` instead.`,
      );
    }
}
// FORK (end 12)
async function getPackagesToRelease(
  changedPackages: Array<string>,
  allPackages: Array<Package>,
): Promise<string[]> {
  if (allPackages.length <= 1)
    throw new InternalError(
      "getPackagesToRelease should not be called if there is only one package",
    );
  const allSortedPackages = allPackages.toSorted((a, b) =>
    a.packageJson.name.localeCompare(b.packageJson.name),
  );
  const changedPackagesList = new Array<Option<string>>();
  const unchangedPackagesList = new Array<Option<string>>();
  for (const { packageJson } of allSortedPackages) {
    const pkgName = packageJson.name;
    (changedPackages.includes(pkgName) ? changedPackagesList : unchangedPackagesList).push({
      label: pkgName + (packageJson.private ? " (private)" : ""),
      value: pkgName,
    });
  }
  const multiselectValues: Record<string, Array<Option<string>>> = {};
  if (changedPackagesList.length > 0) multiselectValues["changed packages"] = changedPackagesList;
  if (unchangedPackagesList.length > 0)
    multiselectValues["unchanged packages"] = unchangedPackagesList;
  return await askMultiselect(
    "Which packages were affected by the changes you made?",
    multiselectValues,
    { required: true },
  );
}
function getPkgJsonsByName(packages: Array<Package>) {
  return new Map(packages.map(({ packageJson }) => [packageJson.name, packageJson]));
}
function formatPkgNameAndVersion(
  pkgName: string,
  version: string,
  // FORK (start 13)
  patchOnlyPackageNames: ReadonlySet<string>,
  // FORK (end 13)
) {
  // FORK (start 14)
  if (patchOnlyPackageNames.has(pkgName)) return src_default.bold(pkgName);
  // FORK (end 14)
  return `${src_default.bold(pkgName)}@${src_default.bold(version)}`;
}
async function confirmMajorRelease({ name, version }: PackageJSON) {
  if (semverLt(version, "1.0.0")) {
    importantWarning(`
The ${src_default.red("major")} version of ${src_default.blue(name)} will be its ${src_default.red("first major release")} (1.0.0).
If you are unsure if this is correct, contact the package's maintainers ${src_default.red("before committing this changeset")}.
      `);

    return askConfirm(
      `Are you sure you want to release the ${src_default.red("first major version")} of ${src_default.blue(name)}?`,
    );
  }
  return true;
}
async function askWithEditor(initialContents = ""): Promise<string> {
  const tmpDir = await fs.mkdtemp(tmpdir());
  const tmpFile = path.join(tmpDir, "changeset.md");

  await fs.writeFile(tmpFile, initialContents);
  launchEditor(tmpFile);

  const done = await confirm({
    message: "Opening external editor...",
    active: "Continue",
    inactive: "Cancel",
    initialValue: true,
  });
  if (!done || isCancel(done)) {
    await fs.rm(tmpDir, { recursive: true });
    return "";
  }

  const contents = await fs.readFile(tmpFile, "utf8");
  await fs.rm(tmpDir, { recursive: true });

  return contents
    .replace(/^#.*\n?/gm, "")
    .replace(/\n+$/g, "")
    .trim();
}
