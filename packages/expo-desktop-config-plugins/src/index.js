const expoConfigPluginsModule = require("@expo/config-plugins");

const {
  withAppDelegate,
  withInfoPlist,
  withEntitlementsPlist,
  withExpoPlist,
  withXcodeProject,
  withPodfile,
  withPodfileProperties,
} = require("./plugins/macos/macos-plugins");

const { withNameSettingsGradle } = require("./plugins/android/Name");
const { withDisplayName } = require("./plugins/ios/Name");
const { withExpoAppDelegate } = require("./plugins/macos/withExpoAppDelegate");
const { withExpoXcodeBuildPhase } = require("./plugins/macos/withExpoXcodeBuildPhase");

const { compileModsAsync, withDefaultBaseMods, evalModsAsync } = require("./plugins/mod-compiler");

const {
  getMacosModFileProviders,
  withMacosBaseMods,
} = require("./plugins/macos/withMacosBaseMods");
const { withMacosJsEnginePodfileProps } = require("./plugins/macos/withMacosJsEnginePodfileProps");
const withWindowSize = require("./plugins/macos/withWindowSize");

const MacOSConfig = {
  Entitlements: require("./plugins/macos/Entitlements"),
  Name: require("./plugins/macos/Name"),
  Paths: require("./plugins/macos/Paths"),
  XcodeUtils: require("./plugins/macos/Xcodeproj"),
};

module.exports = {
  ...expoConfigPluginsModule,

  MacOSConfig,

  withAppDelegate,
  withInfoPlist,
  withEntitlementsPlist,
  withExpoPlist,
  withXcodeProject,
  withPodfile,
  withPodfileProperties,

  withNameSettingsGradle,
  withDisplayName,
  withExpoAppDelegate,
  withExpoXcodeBuildPhase,
  withWindowSize,
  withMacosJsEnginePodfileProps,

  compileModsAsync,
  withDefaultBaseMods,
  evalModsAsync,

  BaseMods: {
    ...expoConfigPluginsModule.BaseMods,
    withMacosBaseMods,
    getMacosModFileProviders,
  },
};
