import { type ExpoConfig } from "@expo/config";

export function readAppNameFromConfig(expoConfig: ExpoConfig) {
  const typedConfig = expoConfig as ExpoConfig & { macos?: ExpoConfig["ios"] };
  const filesafeName = expoConfig.name;
  const expoDesktopConfigPluginsArgs = typedConfig.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-desktop-config-plugins",
  )?.[1] as { displayName?: string; bundleIdentifier?: string } | undefined;

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
