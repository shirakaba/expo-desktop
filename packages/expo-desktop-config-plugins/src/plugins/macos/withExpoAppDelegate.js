// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../xcode.d.ts" />

const { withAppDelegate } = require("./macos-plugins");
const { mergeContents, removeContents } = require("@expo/config-plugins/build/utils/generateCode");

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
  });
}
module.exports.withExpoAppDelegate = withExpoAppDelegate;

/**
 * Declares that the AppDelegate conforms to RNAppAuthAuthorizationFlowManager.
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
  const bundleRootString = language === "swift" ? `"${bundleRoot}"` : `"@${bundleRoot}"`;

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
