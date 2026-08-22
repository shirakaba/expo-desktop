import type { ExpoConfig } from "@expo/config";

import Debug from "debug";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "path";
import { argv } from "process";
import resolveFrom from "resolve-from";
import semver from "semver";

import { packNpmTarballAsync, extractLocalNpmTarballAsync } from "../../common/expo/npm.ts";

const require = createRequire(import.meta.url);
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

// FIXME: This is logic for working within the expo/expo monorepo and would need
//        to be adapted for our workflow. Currently I manage the templates in
//        the expo-desktop-templates repo.
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
    // The default is to use `expo/template.tgz` which exists in all published versions of it
    templatePath = resolveFrom(projectRoot, "expo/template.tgz");
    debug("Using local template from Expo package:", templatePath);
  }

  return await extractLocalNpmTarballAsync(templatePath, templateDirectory, {
    expName: exp.name,
  });
}
