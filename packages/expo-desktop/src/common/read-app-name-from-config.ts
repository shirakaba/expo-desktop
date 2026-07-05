import { type ExpoConfig } from "@expo/config";

export function readAppNameFromConfig(expoConfig: ExpoConfig) {
  const typedConfig = expoConfig as ExpoConfig & { macos?: ExpoConfig["ios"] };
  const filesafeName = expoConfig.name;
  const expoDesktopConfigPluginsArgs = typedConfig.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-desktop-config-plugins",
  )?.[1] as { displayName?: string; bundleIdentifier?: string } | undefined;

  // FIXME: we should be stricter here. If the display name hasn't been provided
  //        explicitly, Expo Desktop should require that it be provided.
  const displayName: string =
    expoDesktopConfigPluginsArgs?.displayName ??
    typedConfig.ios?.infoPlist?.CFBundleName ??
    typedConfig.macos?.infoPlist?.CFBundleName ??
    filesafeName;
  const rdns: string =
    expoDesktopConfigPluginsArgs?.bundleIdentifier ??
    typedConfig?.ios?.bundleIdentifier ??
    typedConfig?.android?.package ??
    "com.helloworld";

  return {
    filesafeName,
    displayName,
    rdns,
  };
}
