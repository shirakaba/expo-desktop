import { log } from "@clack/prompts";
import { getConfig, type ExpoConfig } from "@expo/config";
import { type } from "arktype";
import { default as kleur } from "kleur";
import fs from "node:fs/promises";
import path from "node:path";
import { exit } from "node:process";

import { AppJson } from "../common/app-json.ts";
import { loadEnvFiles, setNodeEnv } from "../common/node-env.ts";
import { type TemplateSelection, applySelectedTemplatesAsync } from "../common/template.ts";
import { clearNativeFolder } from "./clear-native-folder.ts";
import { ensureConfigAsync } from "./ensure-config-async.ts";
import {
  resolvePackageManagerOptions,
  resolveSkipDependencyUpdate,
  resolveTemplateOption,
} from "./resolve-options.ts";
import { updateFromTemplateAsync } from "./update-from-template-async.ts";

/**
 * The entrypoint for `npx expo prebuild` is here:
 * [@expo/cli/src/prebuild/index.ts] expoPrebuild() >
 * [@expo/cli/src/prebuild/configureProjectAsync.ts] configureProjectAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfigAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfig() >
 * [@expo/prebuild-config/src/plugins/withDefaultPlugins.ts] withIosExpoPlugins()
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/index.ts#L7
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/configureProjectAsync.ts#L37
 */
export async function prebuild({
  clean,
  "no-install": noInstall,
  npm,
  yarn,
  bun,
  pnpm,
  template,
  "template-ios": templateIos,
  "template-android": templateAndroid,
  "template-macos": templateMacos,
  "template-windows": templateWindows,
  platform,
  "skip-dependency-update": skipDependencyUpdate,
}: {
  clean: boolean | undefined;
  "no-install": boolean | undefined;
  npm: boolean | undefined;
  yarn: boolean | undefined;
  bun: boolean | undefined;
  pnpm: boolean | undefined;
  template: string | undefined;
  "template-ios": string | undefined;
  "template-android": string | undefined;
  "template-macos": string | undefined;
  "template-windows": string | undefined;
  platform: string | undefined;
  "skip-dependency-update": boolean | undefined;
}) {
  log.info(`🏎️  Running ${kleur.yellow("expo-desktop prebuild")}.`, { withGuide: false });

  let platforms = resolvePlatformsOption(platform);
  const projectRoot = process.cwd();

  setNodeEnv("development");
  loadEnvFiles(projectRoot);

  // Filter out platforms that aren't in the app.json.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L74
  const expoConfig = getConfig(projectRoot).exp;
  if (expoConfig.platforms?.length) {
    const finalPlatforms = platforms.filter((platform) =>
      (expoConfig.platforms as Array<"ios" | "android" | "web" | "macos" | "windows">).includes(
        platform,
      ),
    );
    if (finalPlatforms.length > 0) {
      platforms = finalPlatforms;
    } else {
      const requestedPlatforms = platforms.join(", ");
      console.warn(
        `⚠️  Requested prebuild for "${requestedPlatforms}", but only "${expoConfig.platforms.join(", ")}" is present in app config ("expo.platforms" entry). Continuing with "${requestedPlatforms}".`,
      );
    }
  }

  if (clean) {
    // TODO: maybeBailOnGitStatusAsync()
    // TODO: maybeBailOnNativeModuleAsync()

    // Clear the native folders before syncing
    await clearNativeFolder(projectRoot, platforms);
  } else {
    // TODO: Check if the existing project folders are malformed.
  }

  const { exp, pkg } = await ensureConfigAsync(projectRoot, { platforms });

  const templateSelection = {
    template,
    "template-ios": templateIos,
    "template-android": templateAndroid,
    "template-macos": templateMacos,
    "template-windows": templateWindows,
  } satisfies TemplateSelection;

  // Create native projects from template.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L112-L120
  // https://github.com/expo/expo/blob/e2aa8935077d88fbbb22b1f4dc1f8a1586080b97/packages/%40expo/cli/src/prebuild/updateFromTemplate.ts#L23
  const { hasNewProjectFiles, needsPodInstall, templateChecksum, changedDependencies } =
    await updateFromTemplateAsync(projectRoot, {
      exp,
      pkg,
      templateSelection,
      platforms,
      skipDependencyUpdate: resolveSkipDependencyUpdate(skipDependencyUpdate),
    });

  // TODO: if packageManager undefined, infer from lockfiles
  const _packageManager = resolvePackageManagerOptions({ noInstall, npm, yarn, bun, pnpm });

  // TODO:
  // - prebuildAsync()
  //   - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L49
  //   - getConfig()
  //     - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config/src/Config.ts#L113
  //     - Not sure whether we want to create expo-desktop-config for this
  //   - ensureConfigAsync() is easy to port
  //   - updateFromTemplateAsync() will involve the macos/windows templates
  //   - install node_modules via chosen package manager
  //   - configureProjectAsync()
  //     - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/configureProjectAsync.ts#L14
  //     - Prompt for bundle ID and package name
  //     - getPrebuildConfigAsync() from expo-desktop-prebuild-config
  //     - compileModsAsync()
  //       - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L82
  //       - withDefaultBaseMods()
  //       - evalModsAsync()
  //         - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L126
  //   - Install pods
  //   - updateXcodeProject()
  //     - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/inline-modules/src/xcodeProjectUpdates.ts#L12
  //     - This seems to be something to do with experimental Inline Modules:
  //       - https://docs.expo.dev/modules/inline-modules-reference/

  log.error(`${kleur.yellow("expo-desktop prebuild")} not yet implemented.`);
  return exit(1);
}

function resolvePlatformsOption(platform: string | undefined) {
  if (
    platform !== "macos" &&
    platform !== "windows" &&
    platform !== "desktop" &&
    typeof platform !== "undefined"
  ) {
    throw new Error(
      "Expected --platform arg to be one of: macos | windows | desktop | <undefined>",
    );
  }

  const platforms = new Array<"macos" | "windows">();
  if (platform === "desktop" || platform === "macos") {
    platforms.push("macos");
  }
  if (platform === "desktop" || platform === "windows") {
    platforms.push("windows");
  }
  if (!platforms.length) {
    throw new Error("At least one platform must be enabled when syncing");
  }

  return platforms;
}
