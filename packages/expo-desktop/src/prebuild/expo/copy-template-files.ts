import type { MergeResults } from "@expo/config-plugins/build/utils/generateCode";

import chalk from "chalk";
import Debug from "debug";
import fs from "node:fs";
import path from "node:path";

import { copySync } from "../../common/expo/dir.ts";
import { mergeGitIgnorePaths } from "./merge-gitignore-paths.ts";

const debug = Debug("expo-desktop:prebuild:copyTemplateFiles") as typeof console.log;

type CopyFilesResults = {
  /** Merge results for the root `.gitignore` file */
  gitignore: MergeResults | null;
  /** List of file paths that were copied from the template into the project. */
  copiedPaths: string[];
  /** List of file paths that were skipped due to a number of factors. */
  skippedPaths: string[];
};

/**
 * Return true if the given platforms all have an internal `.gitignore` file.
 *
 * @param projectRoot
 * @param platforms
 */
function hasAllPlatformSpecificGitIgnores(
  projectRoot: string,
  platforms: Array<"ios" | "android" | "macos" | "windows">,
): boolean {
  return platforms.reduce<boolean>(
    (p, platform) => p && fs.existsSync(path.join(projectRoot, platform, ".gitignore")),
    true,
  );
}

/** Create a custom log message based on the copy file results. */
export function createCopyFilesSuccessMessage(
  platforms: Array<"ios" | "android" | "macos" | "windows">,
  { skippedPaths, gitignore }: CopyFilesResults,
): string {
  const pluralized = platforms.length > 1 ? "directories" : "directory";
  let message = `Created native ${pluralized}`;

  if (skippedPaths.length) {
    message += chalk.dim(
      ` | reusing ${skippedPaths.map((path) => chalk.bold(`/${path}`)).join(", ")}`,
    );
  }
  if (!gitignore) {
    // Add no additional message...
  } else if (!gitignore.didMerge) {
    message += chalk.dim(` | reusing gitignore`);
  } else if (gitignore.didMerge && gitignore.didClear) {
    // This is legacy and for non-standard templates. The Expo template adds gitignores to the platform folders.
    message += chalk.dim(` | updated gitignore`);
  }
  return message;
}

/** Copy template files into the project and possibly merge the `.gitignore` files.  */
export function copyTemplateFiles(
  projectRoot: string,
  {
    templateDirectory,
    platforms,
  }: {
    /** File path to the template directory. */
    templateDirectory: string;
    /** List of platforms to copy against. */
    platforms: Array<"ios" | "android" | "macos" | "windows">;
  },
): CopyFilesResults {
  const copiedPaths: string[] = [];
  const skippedPaths: string[] = [];

  platforms.forEach((copyFilePath) => {
    const projectPath = path.join(projectRoot, copyFilePath);
    if (fs.existsSync(projectPath)) {
      skippedPaths.push(copyFilePath);
    } else {
      copiedPaths.push(copyFilePath);
      copySync(path.join(templateDirectory, copyFilePath), projectPath);
    }
  });

  const hasPlatformSpecificGitIgnores = hasAllPlatformSpecificGitIgnores(
    templateDirectory,
    platforms,
  );
  debug(`All platforms have an internal gitignore: ${hasPlatformSpecificGitIgnores}`);

  // TODO: Remove gitignore modifications -- maybe move to `npx expo-doctor`
  const gitignore = hasPlatformSpecificGitIgnores
    ? null
    : mergeGitIgnorePaths(
        path.join(projectRoot, ".gitignore"),
        path.join(templateDirectory, ".gitignore"),
      );

  return { copiedPaths, skippedPaths, gitignore };
}
