const { withNameSettingsGradle } = require("./plugins/android/name");
const { withDisplayName } = require("./plugins/ios/name");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; bundleIdentifier?: string }>}
 */
module.exports = function withExpoDesktop(config, props) {
  config = withNameSettingsGradle(config, props);
  config = withDisplayName(config, props);

  // TODO: We need a plugin to rename files like `myapp6.xcodeproj` to the
  //       actual filesafe name that the user requested. Some examples of
  //       handling that (for renaming the Android package namespace) using
  //       withDangerousMod():
  // https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/android/Package.ts#L30
  // https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/android/Package.ts#L89
  //
  //       Apart from renaming the files, we'd have to update the files
  //       referenced in the pbxproj. Mainly just the entitlements file,
  //       probably.

  return config;
};
