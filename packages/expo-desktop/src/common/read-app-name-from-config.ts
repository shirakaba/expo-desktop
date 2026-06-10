import { type ExpoConfig } from "@expo/config";

export function readAppNameFromConfig(expoConfig: ExpoConfig) {
  const filesafeName = expoConfig.name;
  const expoDesktopConfigPluginsArgs = expoConfig.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-desktop-config-plugins",
  )?.[1] as { displayName?: string; bundleIdentifier?: string } | undefined;

  const displayName = expoDesktopConfigPluginsArgs?.displayName ?? filesafeName;
  const rdns =
    expoDesktopConfigPluginsArgs?.bundleIdentifier ??
    expoConfig?.ios?.bundleIdentifier ??
    expoConfig?.android?.package ??
    "com.helloworld";

  return {
    filesafeName,
    displayName,
    rdns,
  };
}
