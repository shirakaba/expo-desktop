const { withMod } = require("@expo/config-plugins");

/**
 * @template [T=any]
 * @typedef {import("@expo/config-plugins").Mod<T>} Mod
 */

/**
 * @template [Props=void]
 * @typedef {import("@expo/config-plugins").ConfigPlugin<Props>} ConfigPlugin
 */

/**
 * @typedef {import("@expo/config-plugins").InfoPlist} InfoPlist
 * @typedef {import("@expo/config-types").ExpoConfig} ExpoConfig
 * @typedef {import("@expo/config-plugins").ExportedConfig} ExportedConfig
 * @typedef {import("xcode").XcodeProject} XcodeProject
 */

/**
 * @template {string} T
 * @typedef {{ path: string; contents: string; language: T; }} FileInfo<T>
 */

/**
 * A mod to edit the app's entrypoint file (the one that declares and calls
 * the WinMain function). Called MyApp.cpp in the cpp-app template.
 *
 * @param {ExportedConfig} config
 * @param {Mod<FileInfo<"cpp">>} action
 *
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp/MyApp.cpp
 */
const withAppCpp = (config, action) => {
  return withMod(config, {
    platform: "windows",
    mod: "appCpp",
    action,
  });
};
exports.withAppCpp = withAppCpp;

/**
 * A mod to update the app's vcxproj. Called MyApp.vcxproj in the cpp-app
 * template.
 *
 * @param {ExportedConfig} config
 * @param {Mod<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} action
 *
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp/MyApp.vcxproj
 */
const withVcxproj = (config, action) => {
  return withMod(config, {
    platform: "windows",
    mod: "vcxproj",
    action,
  });
};
exports.withVcxproj = withVcxproj;

/**
 * A mod to update the app's wapproj. Called MyApp.Package.wapproj in the
 * cpp-app template.
 *
 * @param {ExportedConfig} config
 * @param {Mod<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} action
 *
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp.Package/MyApp.Package.wapproj
 */
const withWapproj = (config, action) => {
  return withMod(config, {
    platform: "windows",
    mod: "wapproj",
    action,
  });
};
exports.withWapproj = withWapproj;

/**
 * A mod to update the app's wapproj. Called MyApp.Package/Package.appxmanifest in the
 * cpp-app template.
 *
 * @param {ExportedConfig} config
 * @param {Mod<ReturnType<import("fast-xml-parser").XMLParser["parse"]>>} action
 *
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp.Package/MyApp.Package/Package.appxmanifest
 */
const withAppxManifest = (config, action) => {
  return withMod(config, {
    platform: "windows",
    mod: "appxmanifest",
    action,
  });
};
exports.withAppxManifest = withAppxManifest;

/**
 * A mod to update the app's solution file. Called MyApp.sln in the
 * cpp-app template.
 *
 * @param {ExportedConfig} config
 * @param {Mod<FileInfo<"text">>} action
 *
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp.sln
 */
const withSln = (config, action) => {
  return withMod(config, {
    platform: "windows",
    mod: "sln",
    action,
  });
};
exports.withSln = withSln;
