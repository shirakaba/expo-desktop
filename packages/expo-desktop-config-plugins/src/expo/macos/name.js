const { withInfoPlist } = require("./macos-plugins");
const { addWarningMacOS } = require("./_utils/warnings");

/**
 * @see https://github.com/expo/expo/blob/b7362a90eb6a28eb56ab4880248690c61bac01ed/packages/%40expo/config-plugins/src/ios/Name.ts#L45
 */
function setDisplayName(displayName, { CFBundleDisplayName, ...infoPlist }) {
  if (!displayName) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleDisplayName: displayName,
  };
}

/**
 * Claude has poorly tried to inline withName() here:
 * @see https://github.com/expo/expo/blob/b7362a90eb6a28eb56ab4880248690c61bac01ed/packages/%40expo/config-plugins/src/ios/Name.ts#L20
 *
 * Really sloppy compared to the 1:1 faithful one I already wrote in:
 * packages/expo-desktop-config-plugins/src/expo/ios/name.js
 */
function withMacosDisplayName(config, props = {}) {
  return withInfoPlist(config, async (config) => {
    if (config.modRawConfig.macos?.infoPlist?.CFBundleDisplayName !== undefined) {
      if (props.displayName !== undefined) {
        addWarningMacOS(
          "displayName",
          `"macos.infoPlist.CFBundleDisplayName" is set in the config. Ignoring plugin prop "displayName": ${props.displayName}`,
        );
      }
      return config;
    }

    config.modResults = setDisplayName(props.displayName, config.modResults);
    return config;
  });
}

module.exports.setDisplayName = setDisplayName;
module.exports.withMacosDisplayName = withMacosDisplayName;
