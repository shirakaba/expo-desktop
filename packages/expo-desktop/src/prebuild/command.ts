import { log } from "@clack/prompts";
import {} from "@expo/config";
import { default as kleur } from "kleur";
import { exit } from "node:process";

import { prebuildAsync } from "./prebuild-async.ts";
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
  platform,
}: {
  clean: boolean | undefined;
  "no-install": boolean | undefined;
  npm: boolean | undefined;
  yarn: boolean | undefined;
  bun: boolean | undefined;
  pnpm: boolean | undefined;
  template: string | undefined;
  platform: string | undefined;
}) {
  log.info(`🏎️  Running ${kleur.yellow("expo-desktop prebuild")}.`, { withGuide: false });

  // TODO: if packageManager undefined, infer from lockfiles
  const _packageManager = resolvePackageManagerOptions({ noInstall, npm, yarn, bun, pnpm });

  if (template) {
    // macos:
    // - https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native-macos-init/src/cli.ts#L398
    // - https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native/local-cli/generate-macos.js#L18
    // - https://github.com/microsoft/react-native-macos/tree/main/packages/react-native/local-cli/generator-macos/templates/macos
    //
    // windows:
    // - https://github.com/microsoft/react-native-windows/blob/3d64f71ed8495da6a0dcfc1f97bcb8f761986594/packages/%40react-native-windows/cli/src/generator-windows/index.ts#L57
    // - https://github.com/microsoft/react-native-windows/tree/main/vnext/templates/cpp-app
    throw new Error("--template arg not yet implemented.");
  }

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

  prebuildAsync();

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
