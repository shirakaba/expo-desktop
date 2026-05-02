const { AndroidConfig, withSettingsGradle, WarningAggregator } = require("@expo/config-plugins");

const { addWarningAndroid } = WarningAggregator;
const {
  Name: { sanitizeNameForGradle },
} = AndroidConfig;

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string }>}
 * @see https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/android/Name.ts#L28
 */
const withNameSettingsGradle = (config, props) => {
  return withSettingsGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = applyNameSettingsGradle(
        props.displayName,
        config.modResults.contents,
      );
    } else {
      addWarningAndroid(
        "name",
        `Cannot automatically configure settings.gradle if it's not groovy`,
      );
    }
    return config;
  });
};
module.exports.withNameSettingsGradle = withNameSettingsGradle;

/**
 * @param {string} displayName
 * @param {string} settingsGradle
 */
function applyNameSettingsGradle(displayName, settingsGradle) {
  const name = sanitizeNameForGradle(displayName);

  // Select rootProject.name = '***' and replace the contents between the quotes.
  return settingsGradle.replace(
    /rootProject.name\s?=\s?(["'])(?:(?=(\\?))\2.)*?\1/g,
    `rootProject.name = '${name.replace(/'/g, "\\'")}'`,
  );
}
module.exports.applyNameSettingsGradle = applyNameSettingsGradle;
