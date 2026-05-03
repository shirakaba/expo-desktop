import { createRequire } from "node:module";
import * as path from "node:path";

import { withInternal } from "./with-internal.ts";

const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } =
  require("expo-desktop-prebuild-config") as typeof import("expo-desktop-prebuild-config");
const { compileModsAsync } =
  require("expo-desktop-config-plugins") as typeof import("expo-desktop-config-plugins");

/**
 * Applies config plugins.
 * @see https://github.com/microsoft/react-native-test-app/blob/trunk/packages/app/scripts/config-plugins/apply.mjs
 */
export async function applyConfigPlugins(
  options: PrebuildOptions,
): Promise<Awaited<ReturnType<typeof compileModsAsync>> | undefined> {
  const { projectRoot } = options;

  // To avoid making expo-desktop depend on Expo SDK 54 when we might be running
  // on an Expo 55 project, we import Expo deps from the project itself.
  let expoConfigModule: typeof import("@expo/config");
  try {
    expoConfigModule = require(
      path.dirname(require.resolve("@expo/config/package.json", { paths: [projectRoot] })),
    );
  } catch (cause) {
    throw new Error(
      `Error importing "@expo/config" relative to projectRoot "${projectRoot}". Make sure to install node modules before running any prebuilds, and make sure that the project depends on the package named "expo".`,
      { cause },
    );
  }
  const { getConfig } = expoConfigModule;

  let expoConfigPluginsModule: typeof import("@expo/config-plugins");
  try {
    expoConfigPluginsModule = require(
      path.dirname(require.resolve("@expo/config-plugins/package.json", { paths: [projectRoot] })),
    );
  } catch (cause) {
    throw new Error(
      `Error importing "@expo/config-plugins" relative to projectRoot "${projectRoot}". Make sure to install node modules before running any prebuilds, and make sure that the project depends on the package named "expo".`,
      { cause },
    );
  }
  const { withPlugins } = expoConfigPluginsModule;

  // (1) Filter out platforms that aren't in the app.json.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L74
  let { exp: expoConfig } = getConfig(projectRoot);
  const { platforms, plugins } = expoConfig;
  if (platforms?.length) {
    const finalPlatforms = options.platforms.filter((platform) => platforms.includes(platform));
    if (finalPlatforms.length > 0) {
      options.platforms = finalPlatforms;
    } else {
      const requestedPlatforms = options.platforms.join(", ");
      console.warn(
        `⚠️  Requested prebuild for "${requestedPlatforms}", but only "${platforms.join(", ")}" is present in app config ("expo.platforms" entry). Continuing with "${requestedPlatforms}".`,
      );
    }
  }

  const prebuildConfig = await getPrebuildConfigAsync(projectRoot, options);
  expoConfig = prebuildConfig.exp;

  return compileModsAsync(
    withPlugins(withInternal(expoConfig, options), plugins as Array<string>),
    options,
  );
}

export type PrebuildOptions = {
  projectRoot: string;
} & Parameters<typeof getPrebuildConfigAsync>[1];
