const { withNameSettingsGradle } = require("./expo/android/name");
const { withDisplayName } = require("./expo/ios/name");
/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string }>}
 */
module.exports = function withExpoDesktop(config, props) {
  // These two handle the display name
  config = withNameSettingsGradle(config, props);
  config = withDisplayName(config, props);

  return config;
};
