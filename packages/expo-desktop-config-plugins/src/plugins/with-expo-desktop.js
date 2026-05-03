// @ts-ignore Cache issue since I renamed "name.js" to "Name.js"
const { withNameSettingsGradle } = require("./android/Name");
const { withDisplayName: withDisplayNameIos } = require("./ios/Name");
const { withDisplayName: withDisplayNameMacos } = require("./macos/Name");
const { withExpoAppDelegate } = require("./macos/withExpoAppDelegate");
const { withExpoXcodeBuildPhase } = require("./macos/withExpoXcodeBuildPhase");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; bundleIdentifier?: string }>}
 */
module.exports = function withExpoDesktop(config, props) {
  // TODO: Either make all props optional, or throw error when missing.

  config = withNameSettingsGradle(config, props);

  // Same-named mods do not clash, as they are stored by platform first, then
  // mod name (`config.mods[platform][mod]`):
  // https://github.com/expo/expo/blob/9999e24657faffc6536bc3ec95efe9ecfc055fae/packages/%40expo/config-plugins/src/plugins/withMod.ts#L56-L60
  config = withDisplayNameIos(config, props);
  config = withDisplayNameMacos(config, props);

  // We've only made these Config Plugins for macOS because
  // expo-template-bare-minimum sets iOS projects up correctly for iOS to begin
  // with.
  config = withExpoAppDelegate(config, { windowTitle: props.displayName });
  config = withExpoXcodeBuildPhase(config, props);

  // TODO: Set the Xcode PRODUCT_BUNDLE_IDENTIFIER build setting based on
  //       props.bundleIdentifier.

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

// TODO: Decide how to restructure this package.
//       Right now, it's just concerned with exporting a Config Plugin that
//       updates the display name. But the real @expo/config-plugins isn't a
//       Config Plugin at all, just a library of Config Plugins.
// https://github.com/expo/expo/blob/main/packages/%40expo/config-plugins/src/index.ts
