import Debug from "debug";
import fs from "node:fs";
import path from "node:path";
import { match, P } from "ts-pattern";

import { findAncestorWorkspaceAsync } from "./find-ancestor-workspace.ts";
import { Log } from "./log.ts";
import {
  configurePackageManager,
  type ConfigurePackageManagerResult,
  installDependenciesAsync,
  resolvePackageManager,
  type PackageManagerName,
} from "./resolve-package-manager.ts";
import { installPodsAsync, logProjectReady } from "./template.ts";

const debug = Debug("expo-desktop:create-app:createAsyncUtils") as typeof console.log;

/**
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L255
 */
export async function configureNodeDependenciesAsync(
  projectRoot: string,
  packageManager: PackageManagerName,
): Promise<ConfigurePackageManagerResult> {
  const result = await configurePackageManager(projectRoot, packageManager);
  if (result.type === "resolve") return result;
  debug(`Error configuring package manager: %O`, result);
  const message = match(result)
    .with(
      { subtype: "invalid template manifest" },
      ({ filePath, field }) => `Invalid ${field} in ${filePath}.`,
    )
    .with(
      { subtype: "invalid Bun install configuration" },
      ({ filePath }) => `Invalid install settings in ${filePath}. Expected a TOML table.`,
    )
    .with(
      { subtype: "failed to resolve package manager version" },
      ({ packageManager, error }) => `Could not run ${packageManager} --version: ${String(error)}`,
    )
    .with(
      { subtype: "failed to parse package manager version" },
      ({ packageManager, version, error }) =>
        `Could not parse ${packageManager} version ${JSON.stringify(version)}: ${String(error)}`,
    )
    .with(
      { subtype: "unsupported patching version" },
      ({ packageManager, minimumVersion }) =>
        `This template's dependency patches require ${packageManager} ${minimumVersion} or newer. Upgrade and finish configuring the template patches before installing dependencies.`,
    )
    .with(
      { subtype: P.union("failed to access template patch", "failed to register pnpm patch") },
      ({ subtype, dependency, filePath, error }) =>
        `${subtype} for ${dependency} (${filePath}): ${String(error)}`,
    )
    .with(
      { subtype: "failed to encode Yarn patch version" },
      ({ dependency, version, filePath, error }) =>
        `Could not encode Yarn patch version ${JSON.stringify(version)} for ${dependency} (${filePath}): ${String(error)}`,
    )
    .with(
      {
        subtype: P.union(
          "failed to read template manifest",
          "failed to parse template manifest",
          "failed to read package manager configuration",
          "failed to parse Bun configuration",
          "failed to serialize Bun configuration",
          "failed to parse YAML configuration",
          "failed to set YAML node linker",
          "failed to serialize YAML configuration",
          "failed to serialize template manifest",
          "failed to write package manager configuration",
          "failed to write template manifest",
        ),
      },
      ({ subtype, filePath, error }) => `${subtype} (${filePath}): ${String(error)}`,
    )
    .exhaustive();
  Log.error(message);
  if (result.updatedFiles.length) {
    Log.error(`Configuration was partially saved to: ${result.updatedFiles.join(", ")}`);
  }
  Log.error(
    "Automatic installation skipped. Finish configuring the package manager and template patches before installing dependencies.",
  );
  return result;
}

/**
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L247-L253
 */
export function getChangeDirectoryPath(projectRoot: string): string {
  const cdPath = path.relative(process.cwd(), projectRoot);
  if (cdPath.length <= projectRoot.length) {
    return cdPath;
  }
  return projectRoot;
}

/**
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L285
 */
export async function installCocoaPodsAsync(
  projectRoot: string,
  platform: "ios" | "macos",
): Promise<boolean> {
  let podsInstalled = false;
  try {
    podsInstalled = await installPodsAsync(projectRoot, platform);
  } catch (error) {
    debug(`Error installing CocoaPods for ${platform === "ios" ? "iOS" : "macOS"}: %O`, error);
  }

  return podsInstalled;
}

/**
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L270
 */
export async function installNodeDependenciesAsync(
  projectRoot: string,
  packageManager: PackageManagerName,
): Promise<void> {
  try {
    await installDependenciesAsync(projectRoot, packageManager, { silent: false });
  } catch (error: any) {
    debug(`Error installing node modules: %O`, error);
    Log.error(
      `Something went wrong installing JavaScript dependencies. Check your ${packageManager} logs. Continuing to create the app.`,
    );
    Log.exception(error);
  }
}

/**
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L296
 */
export function logNodeInstallWarning({
  cdPath,
  packageManager,
  needsPods,
  isInMonorepo,
}: {
  cdPath: string;
  packageManager: PackageManagerName;
  needsPods: boolean;
  isInMonorepo: boolean;
}): void {
  if (isInMonorepo) {
    console.log(`\n⚠️  This app was created inside a monorepo, preventing automatic setup.`);
    console.log(
      `  ① Follow the below instructions to manually integrate the app into the monorepo:`,
    );
    console.log(`  https://expo-desktop-docs.vercel.app/guides/monorepos`);
    console.log(
      `  ② Having finished that setup, before running your app, make sure to install node modules and CocoaPods:\n`,
    );
  } else {
    console.log(`\n⚠️  Before running your app, make sure you have modules installed:\n`);
  }
  console.log(`  cd ${cdPath || "."}${path.sep}`);
  console.log(`  ${packageManager} install`);
  if (needsPods && process.platform === "darwin") {
    console.log(`  pod install --project-directory=ios && pod install --project-directory=macos`);
  }
  console.log();
}

/**
 *
 * @param projectRoot
 * @param props
 * @see https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L60
 */
export async function setupDependenciesAsync(
  projectRoot: string,
  props: Pick<CreateAsyncOptions, "install">,
) {
  // Detect ancestors before creating local configuration such as pnpm-workspace.yaml.
  const workspaceResult = await findAncestorWorkspaceAsync(projectRoot);
  const isInMonorepo = workspaceResult.type === "resolve" && workspaceResult.workspaceRoot !== null;
  if (workspaceResult.type === "reject") {
    const message = match(workspaceResult)
      .with(
        { subtype: "failed to access pnpm workspace file" },
        ({ filePath, error }) =>
          `Could not access ${filePath} while checking for a monorepo: ${String(error)}`,
      )
      .with(
        { subtype: "failed to read ancestor manifest" },
        ({ filePath, error }) =>
          `Could not read ${filePath} while checking for a monorepo: ${String(error)}`,
      )
      .with(
        { subtype: "failed to parse ancestor manifest" },
        ({ filePath, error }) =>
          `Could not parse ${filePath} while checking for a monorepo: ${String(error)}`,
      )
      .exhaustive();
    Log.error(message);
    Log.error(
      "Automatic installation skipped. Check the enclosing workspace before installing dependencies.",
    );
  }
  const packageManager = resolvePackageManager();

  // Configure package manager, which is unrelated to installing or not
  const configured = await configureNodeDependenciesAsync(projectRoot, packageManager);
  const shouldInstall =
    props.install &&
    workspaceResult.type === "resolve" &&
    !isInMonorepo &&
    configured.type === "resolve";

  // Install dependencies
  let podsInstalledIos: boolean = false;
  const needsPodsInstalledIos = fs.existsSync(path.join(projectRoot, "ios"));
  let podsInstalledMacos: boolean = false;
  const needsPodsInstalledMacos = fs.existsSync(path.join(projectRoot, "macos"));
  if (shouldInstall) {
    await installNodeDependenciesAsync(projectRoot, packageManager);
    if (needsPodsInstalledIos) {
      podsInstalledIos = await installCocoaPodsAsync(projectRoot, "ios");
    }
    if (needsPodsInstalledMacos) {
      podsInstalledMacos = await installCocoaPodsAsync(projectRoot, "macos");
    }
  }
  const cdPath = getChangeDirectoryPath(projectRoot);
  console.log();
  logProjectReady({ cdPath, packageManager });
  if (!shouldInstall) {
    logNodeInstallWarning({
      cdPath,
      packageManager,
      needsPods:
        (needsPodsInstalledIos && !podsInstalledIos) ||
        (needsPodsInstalledMacos && !podsInstalledMacos),
      isInMonorepo,
    });
  }
}

export type CreateAsyncOptions = {
  install: boolean;
  template?: string | true | undefined;
  example?: string | true | undefined;
  yes: boolean;
  agentsMd: boolean;
};
