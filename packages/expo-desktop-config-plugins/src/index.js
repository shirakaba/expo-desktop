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

module.exports.withAppDelegate = withAppDelegate;
module.exports.withInfoPlist = withInfoPlist;
module.exports.withEntitlementsPlist = withEntitlementsPlist;
module.exports.withExpoPlist = withExpoPlist;
module.exports.withXcodeProject = withXcodeProject;
module.exports.withPodfile = withPodfile;
module.exports.withPodfileProperties = withPodfileProperties;

module.exports.withNameSettingsGradle = withNameSettingsGradle;
module.exports.withDisplayName = withDisplayName;
module.exports.withExpoAppDelegate = withExpoAppDelegate;
module.exports.withExpoXcodeBuildPhase = withExpoXcodeBuildPhase;
module.exports.withWindowSize = withWindowSize;
module.exports.withMacosJsEnginePodfileProps = withMacosJsEnginePodfileProps;

module.exports.compileModsAsync = compileModsAsync;
module.exports.withDefaultBaseMods = withDefaultBaseMods;
module.exports.evalModsAsync = evalModsAsync;

module.exports.BaseMods = {
  withMacosBaseMods,
  getMacosModFileProviders,
};

module.exports.MacOSConfig = MacOSConfig;
