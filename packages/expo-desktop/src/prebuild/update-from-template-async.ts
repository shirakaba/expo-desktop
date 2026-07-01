import type { ExpoConfig, PackageJSONConfig } from "@expo/config";

import chalk from "chalk";
import assert from "node:assert";

import type { ResolvedTemplateOption } from "./expo/resolve-options.ts";

import { AbortCommandError, SilentError } from "../common/expo/error.ts";
import { Log } from "../common/expo/log.ts";
import { logNewSection } from "../common/expo/ora.ts";
import {
  getTemplateFilesToRenameAsync,
  getWindowsTemplateStrings,
  renameTemplateAppNameAsync,
} from "../common/expo/template.ts";
import { readAppNameFromConfig } from "../common/read-app-name-from-config.ts";
import { createTempDirectoryPath } from "./create-temp-path.ts";
import { copyTemplateFiles, createCopyFilesSuccessMessage } from "./expo/copy-template-files.ts";
import { cloneTemplateAsync } from "./expo/resolve-template.ts";
import {
  DependenciesModificationResults,
  updatePackageJSONAsync,
} from "./expo/update-package-json.ts";
import { validateTemplatePlatforms } from "./expo/validate-template-platforms.ts";

/**
 * Creates local native files from an input template file path.
 *
 * @return `true` if the project is prebuilding, and `false` if it's syncing.
 */
export async function updateFromTemplateAsync(
  projectRoot: string,
  {
    exp,
    pkg,
    template,
    templateDirectory,
    platforms,
    skipDependencyUpdate,
  }: {
    /** Expo Config */
    exp: ExpoConfig;
    /** package.json as JSON */
    pkg: PackageJSONConfig;
    /** Template to clone from. */
    template?: ResolvedTemplateOption | undefined;
    /** Directory to write the template to before copying into the project. */
    templateDirectory?: string;
    /** List of platforms to clone. */
    platforms: Array<"ios" | "android" | "macos" | "windows">;
    /** List of dependencies to skip updating. */
    skipDependencyUpdate: Array<string> | undefined;
  },
): Promise<
  {
    /** Indicates if new files were created in the project. */
    hasNewProjectFiles: boolean;
    /** Indicates that the project needs to run `pod install` */
    needsPodInstallIos: boolean;
    /** Indicates that the project needs to run `pod install` */
    needsPodInstallMacos: boolean;
    /** The template checksum used to create the native project. */
    templateChecksum: string;
  } & DependenciesModificationResults
> {
  if (!templateDirectory) {
    templateDirectory = createTempDirectoryPath();
  }

  // If React Native Windows isn't installed, then it doesn't matter what
  // template strings we generate anyway, so we provide a fallback.
  const rnwVersion = pkg.dependencies?.["react-native-windows"] ?? "0.81.27";

  const { copiedPaths, templateChecksum } = await cloneTemplateAndCopyToProjectAsync({
    projectRoot,
    template,
    templateDirectory,
    exp,
    platforms,
    rnwVersion,
  });

  const depsResults = await updatePackageJSONAsync(projectRoot, {
    templateDirectory,
    pkg,
    skipDependencyUpdate,
  });

  return {
    hasNewProjectFiles: !!copiedPaths.length,
    // If the iOS folder changes or new packages are added, we should rerun pod install.
    needsPodInstallIos: copiedPaths.includes("ios") || !!depsResults.changedDependencies.length,
    needsPodInstallMacos: copiedPaths.includes("macos") || !!depsResults.changedDependencies.length,
    templateChecksum,
    ...depsResults,
  };
}

/**
 * Extract the template and copy the ios and android directories over to the project directory.
 *
 * @return `true` if any project files were created.
 */
export async function cloneTemplateAndCopyToProjectAsync({
  projectRoot,
  templateDirectory,
  template,
  exp,
  platforms: unknownPlatforms,
  rnwVersion,
}: {
  projectRoot: string;
  templateDirectory: string;
  template?: ResolvedTemplateOption | undefined;
  exp: ExpoConfig;
  platforms: Array<"ios" | "android" | "macos" | "windows">;
  rnwVersion: string;
}): Promise<{ copiedPaths: string[]; templateChecksum: string }> {
  const platformDirectories = unknownPlatforms
    .map((platform) => `./${platform}`)
    .reverse()
    .join(" and ");

  const pluralized = unknownPlatforms.length > 1 ? "directories" : "directory";
  const ora = logNewSection(`Creating native ${pluralized} (${platformDirectories})`);

  try {
    const templateChecksum = await cloneTemplateAsync({
      templateDirectory,
      projectRoot,
      template,
      exp,
      ora,
    });

    const platforms = validateTemplatePlatforms({
      templateDirectory,
      platforms: unknownPlatforms,
    });

    const results = copyTemplateFiles(projectRoot, {
      templateDirectory,
      platforms,
    });

    const name = readAppNameFromConfig(exp);

    const typedConfig = exp as ExpoConfig & {
      windows?: { projectGuid?: string; packageGuid?: string };
    };
    assert(
      typedConfig.windows,
      "Expected windows to have been filled in earlier by ensureConfigAsync().",
    );
    assert(
      typedConfig.windows.packageGuid,
      "Expected windows.packageGuid to have been filled in earlier by ensureConfigAsync().",
    );
    assert(
      typedConfig.windows.projectGuid,
      "Expected windows.projectGuid to have been filled in earlier by ensureConfigAsync().",
    );
    const { packageGuid, projectGuid } = typedConfig.windows;

    // FIXME: Once the mustache is rendered once (e.g. during create-app)
    // this function is no good for updating the packageGuid, projectGuid, and
    // namespace. We need to add that logic to withExpoDesktop() to run at
    // prebuild time based on values configured in app.json.
    // packages/expo-desktop-config-plugins/src/plugins/with-expo-desktop.js
    const windowsTemplateStrings = getWindowsTemplateStrings({
      name,
      rnwVersion,
      packageGuid,
      projectGuid,
    });

    // TODO(@kitten): This duplicates functionality that `cloneTemplateAsync` can already do
    const files = await getTemplateFilesToRenameAsync({ cwd: projectRoot });
    await renameTemplateAppNameAsync({
      cwd: projectRoot,
      files,
      name,
      windowsTemplateStrings,
    });

    // Says: "Created native directories"
    ora.succeed(createCopyFilesSuccessMessage(platforms, results));

    return {
      copiedPaths: results.copiedPaths,
      templateChecksum,
    };
  } catch (e: any) {
    if (!(e instanceof AbortCommandError)) {
      Log.error(e.message);
    }
    ora.fail(`Failed to create the native ${pluralized}`);
    Log.log(
      chalk.yellow(
        chalk`You may want to delete the {bold ./ios} and/or {bold ./android} directories before trying again.`,
      ),
    );
    throw new SilentError(e);
  }
}
