const { mergeContents, removeContents } = require("@expo/config-plugins/build/utils/generateCode");
const { addWarningMacOS } = require("./_utils/warnings");
const { withAppDelegate } = require("./macos-plugins");

/**
 * @param {import("@expo/config-types").ExpoConfig} config
 * @param {{ windowTitle?: string }} props
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

    // Remove any customisations from previous runs so that you can run a dirty
    // prebuild again without duplication.
    config.modResults.contents = removeWindowTitle(config).contents;

    if (props.windowTitle) {
      try {
        config.modResults.contents = addWindowTitle(config, {
          windowTitle: props.windowTitle,
        }).contents;
      } catch (error) {
        if (error.code === "ERR_NO_MATCH") {
          addWarningMacOS(
            "[with-expo-app-delegate] Cannot customise the window title in the ${config.modRequest.platform} project's AppDelegate because the AppDelegate did not contain the expected text to match against. It's expected to contain a call to the superclass's applicationDidFinishLaunching method.",
          );
          return;
        }

        throw error;
      }
    }

    return config;
  });
  return config;
}
module.exports.withExpoAppDelegate = withExpoAppDelegate;

/**
 * Sets the bundle root for the RCTBundleURLProvider.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
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
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
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

/**
 * Sets the title for the NSWindow (it is normally set to the moduleName, which
 * has to be "main").
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
 * @param {{ moduleName: string }} props
 * @returns {import("@expo/config-plugins/build/utils/generateCode").MergeResults}
 */
function setWindowTitle({ modResults: { language, contents } }, { moduleName }) {
  if (language !== "swift" && language !== "objc" && language !== "objcpp") {
    throw new Error(
      `Expected AppDelegate to be in Swift or Obj-C(++), but unexpectedly got '${language}'.`,
    );
  }

  const pattern =
    language === "swift"
      ? superApplicationDidFinishLaunchingRegexSwift
      : superApplicationDidFinishLaunchingRegexObjc;
  const match = pattern.exec(contents);
  if (!match) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }

  // const [fullMatch, prefix, _value] = match;
  const [fullMatch, maybeReturn, superApplicationDidFinishLaunching] = match;
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

/**
 * Adds a call into application(_:open:options:) to handle deeplinks that should
 * be handled by AppAuth.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
 * @param {{ windowTitle: string }} props
 */
function addWindowTitle({ modResults: { language, contents } }, { windowTitle }) {
  if (language !== "swift" && language !== "objc" && language !== "objcpp") {
    throw new Error(
      `Expected AppDelegate to be in Swift or Obj-C(++), but unexpectedly got '${language}'.`,
    );
  }

  // (1) Match on the call to the superclass's applicationDidFinishLaunching
  //     method and set the window title after it.
  contents = mergeContents({
    tag: "expo-desktop-window-title",
    src: contents,
    ...(language === "swift"
      ? {
          newSrc: [
            // "    super.applicationDidFinishLaunching(notification)",
            `    self.window.title = "${windowTitle}"`,
          ].join("\n"),
          anchor:
            // Match this phrase:
            // return super.applicationDidFinishLaunching(notification)
            superApplicationDidFinishLaunchingRegexSwift,
        }
      : {
          newSrc: [
            // "  [super applicationDidFinishLaunching:notification];",
            `  self.window.title = @"${windowTitle}";`,
          ].join("\n"),
          anchor:
            // Match this phrase:
            // return [super applicationDidFinishLaunching:notification];
            superApplicationDidFinishLaunchingRegexObjc,
        }),
    offset: 1,
    comment: "//",
  }).contents;

  // (2) Remove the `return` token before the call, so that our inserted line is
  //     reachable. This is a destructive modification, as it can't be undone
  //     the next time we run the plugin. However, it's a void function in the
  //     first place, so there was never much sense in returning from it.
  const pattern =
    language === "swift"
      ? superApplicationDidFinishLaunchingRegexSwift
      : superApplicationDidFinishLaunchingRegexObjc;
  const match = pattern.exec(contents);
  if (!match) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }

  const [fullMatch, _maybeReturn, superApplicationDidFinishLaunching] = match;
  const leading = `${contents.slice(0, match.index)}`;
  const trailing = `${contents.slice(match.index + fullMatch.length)}`;

  contents = `${leading}${superApplicationDidFinishLaunching}${trailing}`;

  return {
    contents,
    didClear: false,
    didMerge: true,
  };
}

const superApplicationDidFinishLaunchingRegexSwift =
  /(return )?(super\.applicationDidFinishLaunching\(notification\))/;
const superApplicationDidFinishLaunchingRegexObjc =
  /(return )?(\[super applicationDidFinishLaunching:notification\];)/;

/**
 * Removes the call into application(_:open:options:) to handle deeplinks that
 * should be handled by AppAuth.
 * @param {import("@expo/config-plugins").ExportedConfigWithProps<import("@expo/config-plugins/build/ios/Paths").AppDelegateProjectFile>} config
 * @param {Record<string, never>} props
 */
function removeWindowTitle({ modResults: { language, contents } }) {
  return removeContents({ src: contents, tag: "expo-desktop-window-title" });
}
