/**
 * Based on `@expo/config-plugins` UsesNonExemptEncryption.ts (`macos.config.usesNonExemptEncryption`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/UsesNonExemptEncryption.ts
 */

const macosPlugins = require("./macos-plugins");

/** @typedef {import("@expo/config-plugins").InfoPlist} InfoPlist */

const withUsesNonExemptEncryption = macosPlugins.createInfoPlistPluginWithPropertyGuard(
  setUsesNonExemptEncryption,
  {
    infoPlistProperty: "ITSAppUsesNonExemptEncryption",
    expoConfigProperty: "macos.config.usesNonExemptEncryption",
  },
  "withUsesNonExemptEncryption",
);

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 */
function getUsesNonExemptEncryption(config) {
  return config?.macos?.config?.usesNonExemptEncryption ?? null;
}

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @param {InfoPlist & { ITSAppUsesNonExemptEncryption?: unknown }} plistSlice
 * @returns {InfoPlist}
 */
function setUsesNonExemptEncryption(config, { ITSAppUsesNonExemptEncryption, ...infoPlist }) {
  const usesNonExemptEncryption = getUsesNonExemptEncryption(config);

  // Make no changes if the key is left blank
  if (usesNonExemptEncryption === null) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    ITSAppUsesNonExemptEncryption: usesNonExemptEncryption,
  };
}

exports.getUsesNonExemptEncryption = getUsesNonExemptEncryption;
exports.setUsesNonExemptEncryption = setUsesNonExemptEncryption;
exports.withUsesNonExemptEncryption = withUsesNonExemptEncryption;
