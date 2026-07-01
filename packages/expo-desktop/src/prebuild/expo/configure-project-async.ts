import type { ExpoConfig } from "@expo/config";

import { compileModsAsync } from "expo-desktop-config-plugins";
import { getPrebuildConfigAsync } from "expo-desktop-prebuild-config";

import { env } from "../../common/expo/env.ts";
import * as Log from "../../common/expo/log.ts";
import {
  getOrGenerateGuidsAsync,
  getOrPromptForBundleIdentifierAsync,
  getOrPromptForNamespaceAsync,
  getOrPromptForPackageAsync,
} from "../ensure-config-async.ts";
import { logConfig } from "./config-async.ts";

export async function configureProjectAsync(
  projectRoot: string,
  {
    platforms,
    exp,
    templateChecksum,
  }: {
    platforms: Array<"ios" | "android" | "macos" | "windows">;
    exp?: ExpoConfig;
    templateChecksum?: string;
  },
): Promise<ExpoConfig> {
  // Typically you'll want your iOS and macOS bundle identifiers to be
  // identical, so that they share the same App Store page. But we split them up
  // to be as flexible as possible. We continue to support the unified
  // `bundleIdentifier` so that our getPrebuildConfigAsync() can be
  // API-compatible with the upstream implementation.
  let bundleIdentifier: string | undefined;
  let bundleIdentifierIos: string | undefined;
  let bundleIdentifierMacos: string | undefined;
  if (platforms.includes("ios")) {
    // Check bundle ID before reading the config because it may mutate the
    // config if the user is prompted to define it.
    bundleIdentifierIos = await getOrPromptForBundleIdentifierAsync(projectRoot, "ios", exp);
  }
  if (platforms.includes("macos")) {
    bundleIdentifierMacos = await getOrPromptForBundleIdentifierAsync(projectRoot, "macos", exp);
  }
  bundleIdentifier = bundleIdentifierIos ?? bundleIdentifierMacos;

  let windowsNamespace: string | undefined;
  let windowsPackageGuid: string | undefined;
  let windowsProjectGuid: string | undefined;
  if (platforms.includes("windows")) {
    windowsNamespace = await getOrPromptForNamespaceAsync(projectRoot, exp);
    const result = await getOrGenerateGuidsAsync(projectRoot, exp);
    windowsPackageGuid = result.packageGuid;
    windowsProjectGuid = result.projectGuid;
  }

  let packageName: string | undefined;
  if (platforms.includes("android")) {
    packageName = await getOrPromptForPackageAsync(projectRoot, exp);
  }

  let { exp: config } = await getPrebuildConfigAsync(projectRoot, {
    platforms,
    packageName,
    bundleIdentifier,
    bundleIdentifierIos,
    bundleIdentifierMacos,
    windowsNamespace,
    windowsPackageGuid,
    windowsProjectGuid,
  });

  if (templateChecksum) {
    // Prepare template checksum for the patch mods
    config._internal = config._internal ?? {};
    config._internal.templateChecksum = templateChecksum;
  }

  // compile all plugins and mods
  config = await compileModsAsync(config, {
    projectRoot,
    platforms,
    assertMissingModProviders: false,
  });

  if (env.EXPO_DEBUG) {
    Log.log();
    Log.log("Evaluated config:");
    logConfig(config);
    Log.log();
  }

  return config;
}
