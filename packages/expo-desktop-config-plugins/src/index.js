const { withNameSettingsGradle } = require("./expo/android/name");
const { withDisplayName } = require("./expo/ios/name");
/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string }>}
 */
module.exports = function withExpoDesktop(config, props) {
  // Display name for Android
  config = withNameSettingsGradle(config, props);
  // Display name for iOS
  config = withDisplayName(config, props);

  return config;
};
