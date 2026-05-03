/**
 * Based on `@expo/config-plugins` DeviceFamily.ts (`macos.supportsTablet` / `macos.isTabletOnly`; skips `TARGETED_DEVICE_FAMILY` on macOS-native build configs).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/DeviceFamily.ts
 */

const macosPlugins = require("./macos-plugins");
const { addWarningMacOS } = require("./_utils/warnings");

/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * @type {import("@expo/config-plugins").ConfigPlugin}
 */
function withDeviceFamily(config) {
  return macosPlugins.withXcodeProject(config, async (config) => {
    config.modResults = await setDeviceFamily(config, {
      project: config.modResults,
    });
    return config;
  });
}
Object.defineProperty(withDeviceFamily, "name", {
  value: "withDeviceFamily",
});

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {boolean}
 */
function getSupportsTablet(config) {
  return !!config.macos?.supportsTablet;
}

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {boolean}
 */
function getIsTabletOnly(config) {
  return !!config?.macos?.isTabletOnly;
}

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {number[]}
 */
function getDeviceFamilies(config) {
  const supportsTablet = getSupportsTablet(config);
  const isTabletOnly = getIsTabletOnly(config);

  if (isTabletOnly && config.macos?.supportsTablet === false) {
    addWarningMacOS(
      "macos.supportsTablet",
      "Found contradictory values: `{ macos: { isTabletOnly: true, supportsTablet: false } }`. Using `{ isTabletOnly: true }`.",
    );
  }

  // 1 is iPhone, 2 is iPad
  if (isTabletOnly) {
    return [2];
  } else if (supportsTablet) {
    return [1, 2];
  } else {
    // is iPhone only
    return [1];
  }
}

/**
 * Wrapping the families in double quotes is the only way to set a value with a comma in it.
 *
 * @param {number[]} deviceFamilies
 * @returns {string}
 */
function formatDeviceFamilies(deviceFamilies) {
  return `"${deviceFamilies.join(",")}"`;
}

/**
 * Add to pbxproj under TARGETED_DEVICE_FAMILY
 *
 * Purely native macOS targets (with `MACOSX_DEPLOYMENT_TARGET`) are left unchanged: iPhone/iPad families do not apply.
 *
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @param {{ project: XcodeProject }} opts
 * @returns {XcodeProject}
 */
function setDeviceFamily(config, { project: proj }) {
  const deviceFamilies = formatDeviceFamilies(getDeviceFamilies(config));

  const configurations = proj.pbxXCBuildConfigurationSection();
  // @ts-ignore — mirrors upstream: iterate values like Expo’s DeviceFamily.ts
  for (const { buildSettings } of Object.values(configurations || {})) {
    // Guessing that this is the best way to emulate Xcode.
    // Using `project.addToBuildSettings` modifies too many targets.
    if (typeof buildSettings?.PRODUCT_NAME !== "undefined") {
      if (typeof buildSettings?.MACOSX_DEPLOYMENT_TARGET !== "undefined") {
        continue;
      }
      if (typeof buildSettings?.TVOS_DEPLOYMENT_TARGET !== "undefined") {
        buildSettings.TARGETED_DEVICE_FAMILY = "3";
      } else {
        buildSettings.TARGETED_DEVICE_FAMILY = deviceFamilies;
      }
    }
  }

  return proj;
}

exports.formatDeviceFamilies = formatDeviceFamilies;
exports.getDeviceFamilies = getDeviceFamilies;
exports.getIsTabletOnly = getIsTabletOnly;
exports.getSupportsTablet = getSupportsTablet;
exports.setDeviceFamily = setDeviceFamily;
exports.withDeviceFamily = withDeviceFamily;
