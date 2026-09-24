const { withNameSettingsGradle } = require("./android/Name");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; }>}
 */
module.exports = function withExpoAndroid(config, props) {
  config = withNameSettingsGradle(config, props);

  return config;
};
