import type { ExpoConfig } from "@expo/config";

import Debug from "debug";
import fs from "node:fs/promises";
import path from "path";
import { argv } from "process";
import resolveFrom from "resolve-from";
import semver from "semver";

import { packNpmTarballAsync, extractLocalNpmTarballAsync } from "../../common/expo/npm.ts";

const debug = Debug("expo-desktop:prebuild:resolveLocalTemplate") as typeof console.log;

/** Returns the `local-template` target path, only for the `expo/expo` monorepo */
const getMonorepoTemplatePath = async () => {
  /** The logic that Expo use in the `expo/expo` monorepo: */
  // const cliPath = path.dirname(require.resolve("@expo/cli/package.json"));
  // const localTemplateOriginPath = path.join(cliPath, "local-template");
  // try {
  //   return await fs.promises.realpath(localTemplateOriginPath);
  // } catch {
  //   return null;
  // }

  // If it's being run from source, e.g. `node ../src/cli.ts prebuild`, then we
  // know we're in development mode.
  if (!argv.at(1)?.endsWith(".ts")) {
    return null;
  }

  let expoDesktopPath;
  try {
    expoDesktopPath = path.dirname(
      new URL(import.meta.resolve("expo-desktop/package.json")).pathname,
    );
  } catch (error) {
    return null;
  }

  const monorepoRoot = path.resolve(expoDesktopPath, "../..");
  const bareMinimum = path.resolve(monorepoRoot, "templates/bare-minimum");

  // Unlike the expo monorepo, we plan to maintain multiple versions of
  // bare-minimum side-by-side on the same branch. Let's resolve the latest one.
  let versions: Array<string>;
  try {
    versions = await fs.readdir(bareMinimum, "utf-8");
  } catch (error) {
    return null;
  }

  const highestVersion = semver.rsort(versions).at(0);
  if (!highestVersion) {
    return null;
  }
  return path.resolve(bareMinimum, highestVersion);
};

export async function resolveLocalTemplateAsync({
  templateDirectory,
  projectRoot,
  exp,
}: {
  templateDirectory: string;
  projectRoot: string;
  exp: Pick<ExpoConfig, "name">;
}): Promise<string> {
  let templatePath: string;

  // In the expo/expo monorepo, they resolve packages/@expo/cli/local-template,
  // which symlinks to templates/expo-template-bare-minimum.
  //
  // In our monorepo, we resolve templates/bare-minimum/<latest version>.
  const monorepoTemplatePath = await getMonorepoTemplatePath();
  if (monorepoTemplatePath) {
    debug("Packing local template from expo-template-bare-minimum path:", monorepoTemplatePath);
    try {
      templatePath = await packNpmTarballAsync(monorepoTemplatePath);
      debug("Using packed local template at:", templatePath);
    } catch (error) {
      // We're vocal here about an error, since we don't expect this to fail, and it's only for our monorepo
      console.error(
        `Failed to pack local expo-template-bare-minimum to be used as a prebuild template:\n`,
        error,
      );
      throw error;
    }
  } else {
    // In Expo projects, the default is to use `expo/template.tgz` as it exists
    // in all published versions of `expo`.
    //
    // In Expo Desktop projects, we can't follow the same convention. The
    // expo-desktop package is a CLI tool and isn't appropriate to be added as a
    // dependency of Expo Desktop apps, so we can't simply bundle a template.tgz
    // into it.
    //
    // So instead, in expo-desktop-template-blank-typescript, we add
    // expo-desktop-template-bare-minimum as a dependency so that we can resolve
    // it relative to the project root. If we don't find it (e.g. because the
    // user has removed that dependency, or hasn't installed dependencies at all
    // yet), then fine, we'll throw an error here and they'll just have to
    // download it afresh from npm.

    // templatePath = resolveFrom(projectRoot, "expo/template.tgz");
    // debug("Using local template from Expo package:", templatePath);

    const npmPackagePath = path.dirname(
      resolveFrom(projectRoot, "expo-desktop-template-bare-minimum/package.json"),
    );

    // The below is going to look rather redundant (we repack a package that
    // came straight from npm), but we need to turn it into a tarball in order
    // to reuse the complex renaming logic built into
    // extractLocalNpmTarballAsync().

    // If we've already packed this on a previous run, reuse it.
    let existingTarball: string | undefined;
    try {
      for await (const match of fs.glob("expo-desktop-template-bare-minimum-*.tgz", {
        cwd: npmPackagePath,
      })) {
        existingTarball = match;
        break;
      }
    } catch (error) {
      debug(
        "Failed to confirm whether existing tarball was present, so will regenerate. Error: %O",
        error,
      );
    }

    if (existingTarball) {
      templatePath = path.resolve(npmPackagePath, existingTarball);
      debug("Reusing existing tarball for local template at:", templatePath);
    } else {
      try {
        templatePath = await packNpmTarballAsync(npmPackagePath);
        debug("Using packed local template at:", templatePath);
      } catch (error) {
        debug(
          "Failed to pack expo-desktop-template-bare-minimum found in node_modules to be used as a prebuild template: %O",
          error,
        );
        throw error;
      }
    }
  }

  return await extractLocalNpmTarballAsync(templatePath, templateDirectory, {
    expName: exp.name,
  });
}
