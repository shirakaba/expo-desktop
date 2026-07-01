import type { ModConfig } from "@expo/config-plugins";

import { createRequire } from "node:module";

import { withInternal } from "./with-internal.ts";

const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } =
  require("expo-desktop-prebuild-config") as typeof import("expo-desktop-prebuild-config");
const { compileModsAsync } =
  require("expo-desktop-config-plugins") as typeof import("expo-desktop-config-plugins");

// These are subdependencies of expo-desktop-prebuild-config.
const { getConfig } = require("@expo/config") as typeof import("@expo/config");
const { withPlugins } = require("@expo/config-plugins") as typeof import("@expo/config-plugins");

/**
 * Applies config plugins.
 * @see https://github.com/microsoft/react-native-test-app/blob/trunk/packages/app/scripts/config-plugins/apply.mjs
 */
export async function applyConfigPlugins(
  options: PrebuildOptions,
): Promise<Awaited<ReturnType<typeof compileModsAsync>> | undefined> {
  const { projectRoot } = options;

  // Filter out platforms that aren't in the app.json.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L74
  let { exp: expoConfig } = getConfig(projectRoot);
  const { platforms, plugins } = expoConfig;
  if (platforms?.length) {
    const finalPlatforms = options.platforms.filter((platform) =>
      platforms.includes(platform as keyof ModConfig),
    );
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
