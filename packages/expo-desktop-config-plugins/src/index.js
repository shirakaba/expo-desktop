const {
  withRunOnce,
  createRunOncePlugin,
} = require("@expo/config-plugins/build/plugins/withRunOnce");

const { withDangerousMod } = require("@expo/config-plugins/build/plugins/withDangerousMod");
const { withFinalizedMod } = require("@expo/config-plugins/build/plugins/withFinalizedMod");
const { withMod, withBaseMod } = require("@expo/config-plugins/build/plugins/withMod");

const {
  withAppDelegate,
  withInfoPlist,
  withEntitlementsPlist,
  withExpoPlist,
  withXcodeProject,
  withPodfile,
  withPodfileProperties,
} = require("./plugins/macos/macos-plugins");

const {
  withAndroidManifest,
  withStringsXml,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withMainActivity,
  withMainApplication,
  withProjectBuildGradle,
  withAppBuildGradle,
  withSettingsGradle,
  withGradleProperties,
} = require("@expo/config-plugins/build/plugins/android-plugins");

// @ts-ignore Cache issue since I renamed "name.js" to "Name.js"
const { withNameSettingsGradle } = require("./plugins/android/Name");
const { withDisplayName } = require("./plugins/ios/Name");
const { withExpoAppDelegate } = require("./plugins/macos/withExpoAppDelegate");
const { withExpoXcodeBuildPhase } = require("./plugins/macos/withExpoXcodeBuildPhase");

const { compileModsAsync, withDefaultBaseMods, evalModsAsync } = require("./plugins/mod-compiler");

const { withMacosBaseMods } = require("./plugins/macos/withMacosBaseMods");
const { withMacosJsEnginePodfileProps } = require("./plugins/macos/withMacosJsEnginePodfileProps");
const withWindowSize = require("./plugins/macos/withWindowSize");

const expoConfigPlugins = require("@expo/config-plugins");
const {
  BaseMods: OriginalBaseMods,
  assertValidAndroidAssetName,
  PluginError,
  withStaticPlugin,
  isValidAndroidAssetName,
} = expoConfigPlugins;

const BaseMods = {
  ...OriginalBaseMods,
  withMacosBaseMods,
};

const MacOSConfig = {
  Entitlements: require("./plugins/macos/Entitlements"),
  Name: require("./plugins/macos/Name"),
  Paths: require("./plugins/macos/Paths"),
  XcodeUtils: require("./plugins/macos/Xcodeproj"),
};

module.exports = {
  ...expoConfigPlugins,

  MacOSConfig,

  withRunOnce,
  createRunOncePlugin,
  withDangerousMod,
  withFinalizedMod,
  withMod,
  withBaseMod,

  withAppDelegate,
  withInfoPlist,
  withEntitlementsPlist,
  withExpoPlist,
  withXcodeProject,
  withPodfile,
  withPodfileProperties,

  withAndroidManifest,
  withStringsXml,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withMainActivity,
  withMainApplication,
  withProjectBuildGradle,
  withAppBuildGradle,
  withSettingsGradle,
  withGradleProperties,

  isValidAndroidAssetName,
  assertValidAndroidAssetName,
  withStaticPlugin,

  withNameSettingsGradle,
  withDisplayName,
  withExpoAppDelegate,
  withExpoXcodeBuildPhase,
  withWindowSize,
  withMacosJsEnginePodfileProps,

  compileModsAsync,
  withDefaultBaseMods,
  evalModsAsync,

  PluginError,
  BaseMods,
};
