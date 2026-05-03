const { createInfoPlistPluginWithPropertyGuard } = require("./macos-plugins");

const withVersion = createInfoPlistPluginWithPropertyGuard(
  setVersion,
  {
    infoPlistProperty: "CFBundleShortVersionString",
    expoConfigProperty: "version | ios.version",
    expoPropertyGetter: getVersion,
  },
  "withVersion",
);
module.exports.withVersion = withVersion;

const withBuildNumber = createInfoPlistPluginWithPropertyGuard(
  setBuildNumber,
  {
    infoPlistProperty: "CFBundleVersion",
    expoConfigProperty: "ios.buildNumber",
  },
  "withBuildNumber",
);
module.exports.withBuildNumber = withBuildNumber;

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "version" | "macos">} config
 */
function getVersion(config) {
  return config.macos?.version || config.version || "1.0.0";
}
module.exports.getVersion = getVersion;

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "version" | "macos">} config
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @return {import("@expo/config-plugins").InfoPlist}
 */
function setVersion(config, infoPlist) {
  return {
    ...infoPlist,
    CFBundleShortVersionString: getVersion(config),
  };
}
module.exports.setVersion = setVersion;

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "version" | "macos">} config
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @return {import("@expo/config-plugins").InfoPlist}
 */
function getBuildNumber(config) {
  return config.macos?.buildNumber ? config.macos.buildNumber : "1";
}
module.exports.getBuildNumber = getBuildNumber;

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "version" | "macos">} config
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @return {import("@expo/config-plugins").InfoPlist}
 */
function setBuildNumber(config, infoPlist) {
  return {
    ...infoPlist,
    CFBundleVersion: getBuildNumber(config),
  };
}
module.exports.setBuildNumber = setBuildNumber;
