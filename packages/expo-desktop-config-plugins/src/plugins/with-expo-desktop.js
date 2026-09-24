const withExpoAndroid = require("./with-expo-android");
const withExpoIos = require("./with-expo-ios");
const withExpoMacos = require("./with-expo-macos");
const withExpoWindows = require("./with-expo-windows");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; filesafeName?: string | undefined; bundleIdentifier?: string; bundleEntryFileCandidates?: Array<string>; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }>}
 *
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/config-plugins/src/index.ts
 */
module.exports = function withExpoDesktop(config, props) {
  config = withExpoAndroid(config, props);
  config = withExpoIos(config, props);
  config = withExpoMacos(config, props);
  config = withExpoWindows(config, props);

  return config;
};
