import { log } from "@clack/prompts";
import { type } from "arktype";
import { default as kleur } from "kleur";
import fs from "node:fs/promises";
import path from "node:path";
import { exit } from "node:process";

import { AppJson } from "../common/app-json.ts";
import { type TemplateSelection, applySelectedTemplatesAsync } from "../common/template.ts";
import { resolvePackageManagerOptions } from "./resolve-options.ts";

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
}) {
  log.info(`🏎️  Running ${kleur.yellow("expo-desktop prebuild")}.`, { withGuide: false });

  // TODO: if packageManager undefined, infer from lockfiles
  const _packageManager = resolvePackageManagerOptions({ noInstall, npm, yarn, bun, pnpm });

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

  const templateSelection = {
    template,
    "template-ios": templateIos,
    "template-android": templateAndroid,
    "template-macos": templateMacos,
    "template-windows": templateWindows,
  } satisfies TemplateSelection;

  if (clean && hasTemplateSelection(templateSelection)) {
    const projectRoot = process.cwd();
    const appName = await readAppNameFromConfigAsync(projectRoot);
    await applySelectedTemplatesAsync({
      projectRoot,
      selection: templateSelection,
      enabledPlatforms: platforms,
      name: appName,
    });
    log.info("Applied project templates for clean prebuild.", { withGuide: false });
  }

  // TODO:
  // - prebuildAsync()
  //   - https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L49
  //   - getConfig() from expo-desktop-config
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

function hasTemplateSelection(selection: TemplateSelection) {
  return Boolean(
    selection.template ||
    selection["template-ios"] ||
    selection["template-android"] ||
    selection["template-macos"] ||
    selection["template-windows"],
  );
}

async function readAppNameFromConfigAsync(projectRoot: string) {
  const appJsonPath = path.join(projectRoot, "app.json");
  const contents = await fs.readFile(appJsonPath, "utf8");
  const parsed = AppJson(JSON.parse(contents));
  if (parsed instanceof type.errors) {
    throw new Error("Invalid app.json while resolving template replacements.");
  }
  const filesafeName = parsed.expo?.name ?? "HelloWorld";
  const displayName = parsed.expo?.name ?? filesafeName;
  const rdns =
    parsed.expo?.ios?.bundleIdentifier ?? parsed.expo?.android?.package ?? "com.helloworld";
  return {
    filesafeName,
    displayName,
    rdns,
  };
}
