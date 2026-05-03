const { withAppDelegate } = require("./macos-plugins");

/**
 * @param {import("@expo/config-types").ExpoConfig} config
 * @param {{}} props
 * @returns {import("@expo/config-plugins").ExportedConfig}
 *
 * @see https://github.com/expo/expo/blob/0b44f3516dc9c9be348d521dd027bc1efa889787/packages/%40expo/config-plugins/src/ios/Maps.ts#L167
 */
function withExpoAppDelegate(config, props) {
  config = withAppDelegate(config, (config) => {
    config.modResults.contents = setBundleRoot(config, {
      bundleRoot: ".expo/.virtual-metro-entry",
    }).contents;
    config.modResults.contents = setModuleName(config, {
      moduleName: "main",
    }).contents;

    return config;
  });
  return config;
}
module.exports.withExpoAppDelegate = withExpoAppDelegate;

/**
 * Sets the bundle root for the RCTBundleURLProvider.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} src
 * @param {{ bundleRoot: string }} props
 * @returns {import("@expo/config-plugins/build/utils/generateCode").MergeResults}
 */
function setBundleRoot({ modResults: { language, contents } }, { bundleRoot }) {
  if (language !== "swift" && language !== "objc" && language !== "objcpp") {
    throw new Error(
      `Expected AppDelegate to be in Swift or Obj-C(++), but unexpectedly got '${language}'.`,
    );
  }

  const pattern = language === "swift" ? bundleRootRegexSwift : bundleRootRegexObjc;
  const match = pattern.exec(contents);
  if (!match) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }

  const [fullMatch, prefix, _value, suffix] = match;
  const leading = `${contents.slice(0, match.index)}${prefix}`;
  const trailing = `${suffix}${contents.slice(match.index + fullMatch.length)}`;
  const bundleRootString = language === "swift" ? `"${bundleRoot}"` : `@"${bundleRoot}"`;

  const modified = `${leading}${bundleRootString}${trailing}`;

  return {
    contents: modified,
    didClear: false,
    didMerge: true,
  };
}

const bundleRootRegexSwift =
  /(RCTBundleURLProvider\.sharedSettings\(\)\.jsBundleURL\(forBundleRoot:\s*)(.*)(\s*\))/;
const bundleRootRegexObjc =
  /(\[\[RCTBundleURLProvider sharedSettings\] jsBundleURLForBundleRoot:\s*)(.*)(\s*\])/;

/**
 * Sets the moduleName for the RCTAppDelegate, which is used by its
 * RCTRootViewFactory, ultimately passed onto RCTFabricSurface and finally a
 * SurfaceHandler, where the moduleName is used as the Surface's moduleName in
 * the AppRegistry.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} src
 * @param {{ moduleName: string }} props
 * @returns {import("@expo/config-plugins/build/utils/generateCode").MergeResults}
 */
function setModuleName({ modResults: { language, contents } }, { moduleName }) {
  if (language !== "swift" && language !== "objc" && language !== "objcpp") {
    throw new Error(
      `Expected AppDelegate to be in Swift or Obj-C(++), but unexpectedly got '${language}'.`,
    );
  }

  const pattern = language === "swift" ? moduleNameRegexSwift : moduleNameRegexObjc;
  const match = pattern.exec(contents);
  if (!match) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }

  const [fullMatch, prefix, _value] = match;
  const leading = `${contents.slice(0, match.index)}${prefix}`;
  const trailing = `${contents.slice(match.index + fullMatch.length)}`;
  const moduleNameString = language === "swift" ? `"${moduleName}"` : `@"${moduleName}"`;

  const modified = `${leading}${moduleNameString}${trailing}`;

  return {
    contents: modified,
    didClear: false,
    didMerge: true,
  };
}

const moduleNameRegexSwift = /(withModuleName:\s*)(".*")/;
const moduleNameRegexObjc = /(self.moduleName =\s*)(@".*")/;
