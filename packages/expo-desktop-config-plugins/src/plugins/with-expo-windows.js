const { withExpoAppCpp } = require("./windows/withExpoAppCpp");
const { withReactNativeDirs } = require("./windows/withReactNativeDirs");
const { withTemplateVariables } = require("./windows/withTemplateVariables");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; filesafeName?: string | undefined; bundleEntryFileCandidates?: Array<string>; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; }>}
 */
module.exports = function withExpoWindows(config, props) {
  // Windows-only config plugins
  // TODO: We need a config plugin for renaming the Windows namespace,
  // packageGuid, and projectGuid from the app.json.
  config = withExpoAppCpp(config, { windowTitle: props.displayName });
  config = withReactNativeDirs(config, {
    bundleEntryFileCandidates: props.bundleEntryFileCandidates,
  });
  config = withTemplateVariables(config, {
    displayName: props.displayName,
    filesafeName: props.filesafeName,
    windowsNamespace: props.windowsNamespace,
    windowsPackageGuid: props.windowsPackageGuid,
    windowsProjectGuid: props.windowsProjectGuid,
  });

  return config;
};
