const { withAppDelegate } = require("./macos-plugins");

/**
 * @param {import("@expo/config-types").ExpoConfig} config
 * @param {{ width?: number; height?: number }} [props]
 * @returns {import("@expo/config-plugins").ExportedConfig}
 *
 * @see https://github.com/expo/expo/blob/0b44f3516dc9c9be348d521dd027bc1efa889787/packages/%40expo/config-plugins/src/ios/Maps.ts#L167
 */
function withWindowSize(config, { width = 1280, height = 720 } = {}) {
  config = withAppDelegate(config, (config) => {
    config.modResults.contents = setWindowSize(config, { width, height }).contents;

    return config;
  });
  return config;
}
module.exports.withWindowSize = withWindowSize;

/**
 * Sets the initial defaultSize value for the Window in AppDelegate.swift.
 * No-ops on non-Swift files.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
 * @param {{ width: number; height: number }} props
 * @returns {import("@expo/config-plugins/build/utils/generateCode").MergeResults}
 */
function setWindowSize({ modResults: { language, contents } }, { width, height }) {
  if (language !== "swift") {
    return {
      contents,
      didClear: false,
      didMerge: true,
    };
  }

  const pattern = sizeRegexSwift;
  const match = pattern.exec(contents);
  if (!match) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }

  const [fullMatch, prefix, _value] = match;
  const leading = `${contents.slice(0, match.index)}${prefix}`;
  const trailing = `${contents.slice(match.index + fullMatch.length)}`;
  const sizeString = `(width: ${width}, height: ${height})`;

  contents = `${leading}${sizeString}${trailing}`;

  return {
    contents,
    didClear: false,
    didMerge: true,
  };
}

const sizeRegexSwift = /(\.defaultSize)(\(width:.*?, height:.*?\))/;
