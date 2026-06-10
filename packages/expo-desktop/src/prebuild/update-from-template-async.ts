import type { ExpoConfig, PackageJSONConfig } from "@expo/config";

import type { ResolvedTemplateOption } from "./resolve-options.ts";

import { createTempDirectoryPath } from "./create-temp-path.ts";
import {
  DependenciesModificationResults,
  updatePackageJSONAsync,
} from "./update-package-json-async.ts";

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
    template?: ResolvedTemplateOption;
    /** Directory to write the template to before copying into the project. */
    templateDirectory?: string;
    /** List of platforms to clone. */
    platforms: Array<"macos" | "windows">;
    /** List of dependencies to skip updating. */
    skipDependencyUpdate: Array<string> | undefined;
  },
): Promise<
  {
    /** Indicates if new files were created in the project. */
    hasNewProjectFiles: boolean;
    /** Indicates that the project needs to run `pod install` */
    needsPodInstall: boolean;
    /** The template checksum used to create the native project. */
    templateChecksum: string;
  } & DependenciesModificationResults
> {
  if (!templateDirectory) {
    templateDirectory = createTempDirectoryPath();
  }

  const { copiedPaths, templateChecksum } = await cloneTemplateAndCopyToProjectAsync({
    projectRoot,
    template,
    templateDirectory,
    exp,
    platforms,
  });

  const depsResults = await updatePackageJSONAsync(projectRoot, {
    templateDirectory,
    pkg,
    skipDependencyUpdate,
  });

  return {
    hasNewProjectFiles: !!copiedPaths.length,
    // If the iOS folder changes or new packages are added, we should rerun pod install.
    needsPodInstall: copiedPaths.includes("ios") || !!depsResults.changedDependencies.length,
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
}: {
  projectRoot: string;
  templateDirectory: string;
  template?: ResolvedTemplateOption | undefined;
  exp: Pick<ExpoConfig, "name" | "sdkVersion">;
  platforms: Array<"macos" | "windows">;
}): Promise<{ copiedPaths: string[]; templateChecksum: string }> {
  throw new Error("Not implemented");
}
