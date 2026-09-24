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
const withExpoAndroid = require("expo-desktop-config-plugins/plugins/with-expo-android");
const withExpoIos = require("expo-desktop-config-plugins/plugins/with-expo-ios");
const withExpoMacos = require("expo-desktop-config-plugins/plugins/with-expo-macos");
const withExpoWindows = require("expo-desktop-config-plugins/plugins/with-expo-windows");

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

/**
 * @param {Parameters<(typeof withAndroidExpoPlugins)>[0]} config
 * @param {Parameters<(typeof withAndroidExpoPlugins)>[1]} props
 */
module.exports.withAndroidExpoPlugins = function withAndroidExpoPluginsImproved(config, props) {
  config = withAndroidExpoPlugins(config, props);

  // This sets the display name in settings.gradle from props.displayName
  config = withExpoAndroid(config, props);

  return config;
};
/**
 * @param {Parameters<(typeof withIosExpoPlugins)>[0]} config
 * @param {Parameters<(typeof withIosExpoPlugins)>[1]} props
 */
module.exports.withIosExpoPlugins = function withIosExpoPluginsImproved(config, props) {
  config = withIosExpoPlugins(config, props);

  // Sets the display name with reference to props.displayName, not config.name
  config = withExpoIos(config, props);

  return config;
};
module.exports.withLegacyExpoPlugins = withLegacyExpoPlugins;
module.exports.withVersionedExpoSDKPlugins = withVersionedExpoSDKPlugins;

/**
 * Config plugin to apply all of the custom Expo macOS config plugins we support
 * by default (a port of withIosExpoPlugins()).
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/prebuild-config/src/plugins/withDefaultPlugins.ts#L28
 *
 * Skips when there is no `macos/` folder (e.g. mobile-only workflows).
 *
 * This notably gets run when you call `expo-desktop run macos` while you're
 * missing your `macos/` folder. It DOESN'T get run when you run
 * `expo-desktop prebuild` while you're missing your `macos/` folder (however,
 * withExpoDesktop() does, because it's the entrypoint of
 * expo-desktop-prebuild-config, and *that* does get run).
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

  if (displayName) {
    if (!config.macos.infoPlist) {
      config.macos.infoPlist = {};
    }
    config.macos.infoPlist.CFBundleName = displayName;
  }

  return withPlugins(config, [
    // This is needed to rename "HelloWorld" -> "main" in the AppDelegate.mm.
    [
      withExpoMacos,
      {
        displayName: displayName ?? config.name,
        filesafeName: filesafeName ?? config.name,
      },
    ],
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
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string; filesafeName?: string | undefined; bundleEntryFileCandidates?: Array<string>; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }>}
 */
function withWindowsExpoPlugins(
  config,
  {
    displayName,
    filesafeName,
    bundleEntryFileCandidates,
    windowsNamespace,
    windowsPackageGuid,
    windowsProjectGuid,
  } = {},
) {
  const projectRoot = config._internal?.projectRoot;
  if (typeof projectRoot === "string" && !projectHasWindowsNativeTree(projectRoot)) {
    return config;
  }

  if (!config.windows) {
    config.windows = {};
  }

  return withPlugins(config, [
    [
      withExpoWindows,
      {
        displayName: displayName ?? config.name,
        filesafeName: filesafeName ?? config.name,
        bundleEntryFileCandidates,
        windowsNamespace,
        windowsPackageGuid,
        windowsProjectGuid,
      },
    ],
  ]);
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
