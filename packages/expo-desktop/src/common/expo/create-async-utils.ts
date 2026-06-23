import Debug from "debug";
import fs from "node:fs";
import path from "node:path";

import { Log } from "./log.ts";
import {
  configurePackageManager,
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
): Promise<void> {
  try {
    await configurePackageManager(projectRoot, packageManager, { silent: false });
  } catch (error: any) {
    debug(`Error configuring package manager: %O`, error);
    Log.error(
      `Something went wrong configuring the package manager. Check your ${packageManager} logs. Continuing to create the app.`,
    );
    Log.exception(error);
  }
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
export async function installCocoaPodsAsync(projectRoot: string): Promise<boolean> {
  let podsInstalled = false;
  try {
    podsInstalled = await installPodsAsync(projectRoot);
  } catch (error) {
    debug(`Error installing CocoaPods: %O`, error);
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
export function logNodeInstallWarning(
  cdPath: string,
  packageManager: PackageManagerName,
  needsPods: boolean,
): void {
  console.log(`\n⚠️  Before running your app, make sure you have modules installed:\n`);
  console.log(`  cd ${cdPath || "."}${path.sep}`);
  console.log(`  ${packageManager} install`);
  if (needsPods && process.platform === "darwin") {
    console.log(`  npx pod-install`);
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
  const shouldInstall = props.install;
  const packageManager = resolvePackageManager();

  // Configure package manager, which is unrelated to installing or not
  await configureNodeDependenciesAsync(projectRoot, packageManager);

  // Install dependencies
  let podsInstalled: boolean = false;
  const needsPodsInstalled = await fs.existsSync(path.join(projectRoot, "ios"));
  if (shouldInstall) {
    // Yarn refuses to install if it finds an ancestor directory with a
    // package.json or yarn.lock. I'd rather it install as a separate workspace
    // and that users merge it into their monorepo manually as needed, so we
    // populate an empty yarn.lock file as they suggest.
    if (packageManager === "yarn") {
      await fs.promises.appendFile(path.join(projectRoot, "yarn.lock"), "", "utf-8");
    }

    await installNodeDependenciesAsync(projectRoot, packageManager);
    if (needsPodsInstalled) {
      podsInstalled = await installCocoaPodsAsync(projectRoot);
    }
  }
  const cdPath = getChangeDirectoryPath(projectRoot);
  console.log();
  logProjectReady({ cdPath, packageManager });
  if (!shouldInstall) {
    logNodeInstallWarning(cdPath, packageManager, needsPodsInstalled && !podsInstalled);
  }
}

export type CreateAsyncOptions = {
  install: boolean;
  template?: string | true | undefined;
  example?: string | true | undefined;
  yes: boolean;
  agentsMd: boolean;
};
