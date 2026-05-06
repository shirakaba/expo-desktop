const fs = require("node:fs");
const path = require("node:path");
const { withPlugins } = require("@expo/config-plugins");
const { withBitcode } = require("expo-desktop-config-plugins/plugins/macos/Bitcode");
const {
  withBundleIdentifier,
} = require("expo-desktop-config-plugins/plugins/macos/BundleIdentifier");
const {
  withDeploymentTarget,
  withDeploymentTargetPodfileProps,
} = require("expo-desktop-config-plugins/plugins/macos/DeploymentTarget");
const {
  withDevelopmentTeam,
} = require("expo-desktop-config-plugins/plugins/macos/DevelopmentTeam");
const { withAssociatedDomains } = require("expo-desktop-config-plugins/plugins/macos/Entitlements");
const { withLocales } = require("expo-desktop-config-plugins/plugins/macos/Locales");
const {
  withDisplayName,
  withProductName,
} = require("expo-desktop-config-plugins/plugins/macos/Name");
const { withPrivacyInfo } = require("expo-desktop-config-plugins/plugins/macos/PrivacyInfo");
const { withScheme } = require("expo-desktop-config-plugins/plugins/macos/Scheme");
const {
  withVersion,
  withBuildNumber,
} = require("expo-desktop-config-plugins/plugins/macos/Version");
const {
  withMacosJsEnginePodfileProps,
} = require("expo-desktop-config-plugins/plugins/macos/withMacosJsEnginePodfileProps");
const withExpoDesktop = require("expo-desktop-config-plugins/plugins/with-expo-desktop");

const {
  getAutoPlugins,
  getLegacyExpoPlugins,
  withIosExpoPlugins,
  withAndroidExpoPlugins,
  withLegacyExpoPlugins,
  withVersionedExpoSDKPlugins,
} = require("@expo/prebuild-config/build/plugins/withDefaultPlugins");
module.exports.getAutoPlugins = getAutoPlugins;
module.exports.getLegacyExpoPlugins = getLegacyExpoPlugins;
module.exports.withAndroidExpoPlugins = withAndroidExpoPlugins;
module.exports.withIosExpoPlugins = withIosExpoPlugins;
module.exports.withLegacyExpoPlugins = withLegacyExpoPlugins;
module.exports.withVersionedExpoSDKPlugins = withVersionedExpoSDKPlugins;

/**
 * Config plugin to apply all of the custom Expo macOS config plugins we support
 * by default (a port of withIosExpoPlugins()).
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/prebuild-config/src/plugins/withDefaultPlugins.ts#L28
 *
 * Skips when there is no `macos/` folder (e.g. mobile-only workflows).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string; bundleIdentifier?: string }>}
 */
function withMacosExpoPlugins(config, { bundleIdentifier, displayName }) {
  const projectRoot = config._internal?.projectRoot;
  if (typeof projectRoot === "string" && !projectHasMacosNativeTree(projectRoot)) {
    return config;
  }

  if (!config.macos) {
    config.macos = {};
  }
  if (bundleIdentifier) {
    config.macos.bundleIdentifier = bundleIdentifier;
  }

  return withPlugins(config, [
    [withBundleIdentifier, { bundleIdentifier }],
    // IOSConfig.Google.withGoogle,
    [withDisplayName, { displayName }],
    withProductName,
    // IOSConfig.Orientation.withOrientation,
    // IOSConfig.RequiresFullScreen.withRequiresFullScreen,
    withScheme,
    // IOSConfig.UsesNonExemptEncryption.withUsesNonExemptEncryption,
    withBuildNumber,
    withVersion,
    // IOSConfig.Google.withGoogleServicesFile,
    // == Deployment Target ==
    withDeploymentTarget,
    withDeploymentTargetPodfileProps,
    // == Entitlements ==
    withAssociatedDomains,
    // == XcodeProject ==
    // IOSConfig.DeviceFamily.withDeviceFamily,
    withBitcode,
    withLocales,
    withDevelopmentTeam,
    // == Dangerous ==
    // withIosIcons,
    withPrivacyInfo,
  ]);
}
module.exports.withMacosExpoPlugins = withMacosExpoPlugins;

/**
 * Config plugin to apply all of the custom Expo Windows config plugins we
 * support by default.
 *
 * Skips when there is no `windows/` folder (e.g. mobile-only workflows).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string }>}
 */
function withWindowsExpoPlugins(config, { displayName } = {}) {
  const projectRoot = config._internal?.projectRoot;
  if (typeof projectRoot === "string" && !projectHasWindowsNativeTree(projectRoot)) {
    return config;
  }

  if (!config.windows) {
    config.windows = {};
  }

  return withPlugins(config, [[withExpoDesktop, { displayName: displayName ?? config.name }]]);
}
module.exports.withWindowsExpoPlugins = withWindowsExpoPlugins;

function projectHasMacosNativeTree(projectRoot) {
  try {
    return fs.statSync(path.join(projectRoot, "macos")).isDirectory();
  } catch {
    return false;
  }
}
module.exports.projectHasMacosNativeTree = projectHasMacosNativeTree;

function projectHasWindowsNativeTree(projectRoot) {
  try {
    return fs.statSync(path.join(projectRoot, "windows")).isDirectory();
  } catch {
    return false;
  }
}
module.exports.projectHasWindowsNativeTree = projectHasWindowsNativeTree;
