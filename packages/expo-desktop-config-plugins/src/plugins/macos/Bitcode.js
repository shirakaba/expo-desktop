/**
 * Based on `@expo/config-plugins` Bitcode.ts (`macos.bitcode`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/Bitcode.ts
 */

const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");
const { addWarningMacOS } = require("./_utils/warnings");

/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * Plugin to set a bitcode preference for the Xcode project
 * based on the project's Expo config `macos.bitcode` value.
 *
 * @type {import("@expo/config-plugins").ConfigPlugin}
 */
function withBitcode(config) {
  return macosPlugins.withXcodeProject(config, async (config) => {
    config.modResults = await setBitcodeWithConfig(config, {
      project: config.modResults,
    });
    return config;
  });
}
Object.defineProperty(withBitcode, "name", {
  value: "withBitcode",
});

/**
 * Plugin to set a custom bitcode preference for the Xcode project.
 * Does not read from the Expo config `macos.bitcode`.
 *
 * @param {import("@expo/config-plugins").ExportedConfigWithProps} config
 * @param {boolean | string | null | undefined} bitcode custom bitcode setting.
 * @returns {import("@expo/config-plugins").ExportedConfigWithProps}
 */
function withCustomBitcode(config, bitcode) {
  return macosPlugins.withXcodeProject(config, async (config) => {
    config.modResults = await setBitcode(bitcode, {
      project: config.modResults,
    });
    return config;
  });
}
Object.defineProperty(withCustomBitcode, "name", {
  value: "withCustomBitcode",
});

/**
 * Get the bitcode preference from the Expo config.
 *
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {boolean | string | null | undefined}
 */
function getBitcode(config) {
  return config.macos?.bitcode;
}

/**
 * Enable or disable the `ENABLE_BITCODE` property of the project configurations.
 *
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @param {{ project: XcodeProject }} opts
 * @returns {XcodeProject}
 */
function setBitcodeWithConfig(config, { project: proj }) {
  const bitcode = getBitcode(config);
  return setBitcode(bitcode, { project: proj });
}

/**
 * Enable or disable the `ENABLE_BITCODE` property.
 *
 * @param {boolean | string | null | undefined} bitcode
 * @param {{ project: XcodeProject }} opts
 * @returns {XcodeProject}
 */
function setBitcode(bitcode, { project: proj }) {
  const isDefaultBehavior = bitcode == null;
  // If the value is undefined, then do nothing.
  if (isDefaultBehavior) {
    return proj;
  }

  const targetName = typeof bitcode === "string" ? bitcode : undefined;
  const isBitcodeEnabled = !!bitcode;
  if (targetName) {
    const configs = Object.entries(proj.pbxXCBuildConfigurationSection()).filter(
      Xcodeproj.isNotComment,
    );
    const hasConfiguration = configs.find(([, configuration]) => configuration.name === targetName);
    if (hasConfiguration) {
      // If targetName is defined then disable bitcode everywhere.
      proj.addBuildProperty("ENABLE_BITCODE", "NO");
    } else {
      const names = [
        // Remove duplicates, wrap in double quotes, and sort alphabetically.
        ...new Set(configs.map(([, configuration]) => `"${configuration.name}"`)),
      ].sort();
      addWarningMacOS(
        "macos.bitcode",
        `No configuration named "${targetName}". Expected one of: ${names.join(", ")}.`,
      );
    }
  }

  proj.addBuildProperty("ENABLE_BITCODE", isBitcodeEnabled ? "YES" : "NO", targetName);

  return proj;
}

exports.getBitcode = getBitcode;
exports.setBitcode = setBitcode;
exports.setBitcodeWithConfig = setBitcodeWithConfig;
exports.withBitcode = withBitcode;
exports.withCustomBitcode = withCustomBitcode;
