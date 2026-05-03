const fs = require("node:fs");
const path = require("node:path");
const { withPlugins } = require("@expo/config-plugins");
const {
  withBundleIdentifier,
} = require("expo-desktop-config-plugins/plugins/macos/BundleIdentifier");
const { withAssociatedDomains } = require("expo-desktop-config-plugins/plugins/macos/Entitlements");
const {
  withDisplayName,
  withProductName,
} = require("expo-desktop-config-plugins/plugins/macos/Name");
const { withScheme } = require("expo-desktop-config-plugins/plugins/macos/Scheme");
const {
  withVersion,
  withBuildNumber,
} = require("expo-desktop-config-plugins/plugins/macos/Version");
const {
  withMacosJsEnginePodfileProps,
} = require("expo-desktop-config-plugins/plugins/macos/withMacosJsEnginePodfileProps");

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
    // // Deployment Target
    // IOSConfig.DeploymentTarget.withDeploymentTarget,
    // IOSConfig.DeploymentTarget.withDeploymentTargetPodfileProps,
    // Entitlements
    withAssociatedDomains,
    // XcodeProject
    // IOSConfig.DeviceFamily.withDeviceFamily,
    // IOSConfig.Bitcode.withBitcode,
    // IOSConfig.Locales.withLocales,
    // IOSConfig.DevelopmentTeam.withDevelopmentTeam,
    // // Dangerous
    // withIosIcons,
    // IOSConfig.PrivacyInfo.withPrivacyInfo,
  ]);
}
module.exports.withMacosExpoPlugins = withMacosExpoPlugins;

function projectHasMacosNativeTree(projectRoot) {
  try {
    return fs.statSync(path.join(projectRoot, "macos")).isDirectory();
  } catch {
    return false;
  }
}
module.exports.projectHasMacosNativeTree = projectHasMacosNativeTree;
