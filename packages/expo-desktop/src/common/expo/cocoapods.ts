import type { PackageJSONConfig } from "@expo/config";
import type { default as JsonFileType } from "@expo/json-file";

import { getPackageJson } from "@expo/config";
import * as PackageManager from "@expo/package-manager";
import chalk from "chalk";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { hashForDependencyMap } from "../../prebuild/expo/update-package-json.ts";
import { ensureDirectoryAsync } from "./dir.ts";
import { env } from "./env.ts";
import { AbortCommandError } from "./error.ts";
import * as Log from "./log.ts";
import { logNewSection } from "./ora.ts";

const require = createRequire(import.meta.url);
const JsonFile = (require("@expo/json-file") as typeof JsonFileType).default;

type PackageChecksums = {
  /** checksum for the `package.json` dependency object. */
  dependencies: string;
  /** checksum for the `package.json` devDependency object. */
  devDependencies: string;
};

const PROJECT_PREBUILD_SETTINGS = ".expo/prebuild";
const CACHED_PACKAGE_JSON = "cached-packages.json";

function getTempPrebuildFolder(projectRoot: string): string {
  return path.join(projectRoot, PROJECT_PREBUILD_SETTINGS);
}

function hasNewDependenciesSinceLastBuild(
  projectRoot: string,
  packageChecksums: PackageChecksums,
): boolean {
  // TODO: Maybe comparing lock files would be better...
  const templateDirectory = getTempPrebuildFolder(projectRoot);
  const tempPkgJsonPath = path.join(templateDirectory, CACHED_PACKAGE_JSON);
  if (!fs.existsSync(tempPkgJsonPath)) {
    return true;
  }
  const { dependencies, devDependencies } = JsonFile.read(tempPkgJsonPath);
  // Only change the dependencies if the normalized hash changes, this helps to reduce meaningless changes.
  const hasNewDependencies = packageChecksums.dependencies !== dependencies;
  const hasNewDevDependencies = packageChecksums.devDependencies !== devDependencies;

  return hasNewDependencies || hasNewDevDependencies;
}

function createPackageChecksums(pkg: PackageJSONConfig): PackageChecksums {
  return {
    dependencies: hashForDependencyMap(pkg.dependencies || {}),
    devDependencies: hashForDependencyMap(pkg.devDependencies || {}),
  };
}

/** @returns `true` if the package.json dependency hash does not match the cached hash from the last run. */
export async function hasPackageJsonDependencyListChangedAsync(
  projectRoot: string,
): Promise<boolean> {
  const pkg = getPackageJson(projectRoot);

  const packages = createPackageChecksums(pkg);
  const hasNewDependencies = hasNewDependenciesSinceLastBuild(projectRoot, packages);

  // Cache package.json
  await ensureDirectoryAsync(getTempPrebuildFolder(projectRoot));
  const templateDirectory = path.join(getTempPrebuildFolder(projectRoot), CACHED_PACKAGE_JSON);
  await JsonFile.writeAsync(templateDirectory, packages);

  return hasNewDependencies;
}

export async function installCocoaPodsAsync(
  projectRoot: string,
  platform: "ios" | "macos",
): Promise<boolean> {
  let step = logNewSection("Installing CocoaPods...");
  if (process.platform !== "darwin") {
    step.succeed("Skipped installing CocoaPods because operating system is not on macOS.");
    return false;
  }

  const packageManager = new PackageManager.CocoaPodsPackageManager({
    cwd: path.join(projectRoot, platform),
    silent: !(env.EXPO_DEBUG || env.CI),
  });

  if (!(await packageManager.isCLIInstalledAsync())) {
    try {
      // prompt user -- do you want to install cocoapods right now?
      step.text = "CocoaPods CLI not found in your PATH, installing it now.";
      step.stopAndPersist();
      await PackageManager.CocoaPodsPackageManager.installCLIAsync({
        nonInteractive: true,
        spawnOptions: {
          ...packageManager.options,
          // Don't silence this part
          stdio: ["inherit", "inherit", "pipe"],
        },
      });
      step.succeed("Installed CocoaPods CLI.");
      step = logNewSection("Running `pod install` in the `ios` directory.");
    } catch (error: any) {
      step.stopAndPersist({
        symbol: "⚠️ ",
        text: chalk.red("Unable to install the CocoaPods CLI."),
      });
      if (error instanceof PackageManager.CocoaPodsError) {
        Log.log(error.message);
      } else {
        Log.log(`Unknown error: ${error.message}`);
      }
      return false;
    }
  }

  try {
    await packageManager.installAsync({ spinner: step });
    // Create cached list for later
    await hasPackageJsonDependencyListChangedAsync(projectRoot).catch(() => null);
    step.succeed("Installed CocoaPods");
    return true;
  } catch (error: any) {
    step.stopAndPersist({
      symbol: "⚠️ ",
      text: chalk.red(
        `Something went wrong running \`pod install\` in the \`${platform}\` directory.`,
      ),
    });
    if (error instanceof PackageManager.CocoaPodsError) {
      Log.log(error.message);
    } else {
      Log.log(`Unknown error: ${error.message}`);
    }
    return false;
  }
}

function doesProjectUseCocoaPods(projectRoot: string, platform: "ios" | "macos"): boolean {
  return fs.existsSync(path.join(projectRoot, platform, "Podfile"));
}

function isLockfileCreated(projectRoot: string, platform: "ios" | "macos"): boolean {
  const podfileLockPath = path.join(projectRoot, platform, "Podfile.lock");
  return fs.existsSync(podfileLockPath);
}

function isPodFolderCreated(projectRoot: string, platform: "ios" | "macos"): boolean {
  const podFolderPath = path.join(projectRoot, platform, "Pods");
  return fs.existsSync(podFolderPath);
}

// TODO: Same process but with app.config changes + default plugins.
// This will ensure the user is prompted for extra setup.
export async function maybePromptToSyncPodsAsync(projectRoot: string, platform: "ios" | "macos") {
  if (!doesProjectUseCocoaPods(projectRoot, platform)) {
    // Project does not use CocoaPods
    return;
  }
  if (!isLockfileCreated(projectRoot, platform) || !isPodFolderCreated(projectRoot, platform)) {
    if (!(await installCocoaPodsAsync(projectRoot, platform))) {
      throw new AbortCommandError();
    }
    return;
  }

  // Getting autolinked packages can be heavy, optimize around checking every time.
  if (!(await hasPackageJsonDependencyListChangedAsync(projectRoot))) {
    return;
  }

  await promptToInstallPodsAsync(projectRoot, platform, []);
}

async function promptToInstallPodsAsync(
  projectRoot: string,
  platform: "ios" | "macos",
  missingPods?: string[],
) {
  if (missingPods?.length) {
    Log.log(
      `Could not find the following native modules: ${missingPods
        .map((pod) => chalk.bold(pod))
        .join(", ")}. Did you forget to run "${chalk.bold("pod install")}" ?`,
    );
  }

  try {
    if (!(await installCocoaPodsAsync(projectRoot, platform))) {
      throw new AbortCommandError();
    }
  } catch (error) {
    await fs.promises.rm(path.join(getTempPrebuildFolder(projectRoot), CACHED_PACKAGE_JSON), {
      recursive: true,
      force: true,
    });
    throw error;
  }
}
