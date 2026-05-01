const { withInfoPlist } = require("./macos-plugins");
const { addWarningMacOS } = require("./_utils/warnings");

function setDisplayName(displayName, { CFBundleDisplayName, ...infoPlist }) {
  if (!displayName) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleDisplayName: displayName,
  };
}

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
