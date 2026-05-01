const { withNameSettingsGradle } = require("./expo/android/name");
const { withDisplayName } = require("./expo/ios/name");
const { withMacosExpoPlugins } = require("./expo/macos/withMacosExpoPlugins");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; bundleIdentifier?: string }>}
 */
module.exports = function withExpoDesktop(config, props) {
  config = withNameSettingsGradle(config, props);
  config = withDisplayName(config, props);
  config = withMacosExpoPlugins(config, props);

  return config;
};
