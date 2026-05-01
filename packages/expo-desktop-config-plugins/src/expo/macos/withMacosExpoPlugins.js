const fs = require("fs");
const path = require("path");
const { withPlugins } = require("@expo/config-plugins");
const { withAssociatedDomains } = require("./Entitlements");
const { withMacosDisplayName } = require("./name");
const { withMacosJsEnginePodfileProps } = require("./withMacosJsEnginePodfileProps");

function projectHasMacosNativeTree(projectRoot) {
  try {
    return fs.statSync(path.join(projectRoot, "macos")).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Config plugin to apply all of the custom Expo macOS config plugins we support
 * by default (a port of withIosExpoPlugins()).
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/prebuild-config/src/plugins/withDefaultPlugins.ts#L28
 *
 * Skips when there is no `macos/` folder (e.g. mobile-only workflows).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName?: string; bundleIdentifier?: string }>}
 */
function withMacosExpoPlugins(config, props = {}) {
  const projectRoot = config._internal?.projectRoot;
  if (typeof projectRoot === "string" && !projectHasMacosNativeTree(projectRoot)) {
    return config;
  }

  if (!config.macos) {
    config.macos = {};
  }
  if (props.bundleIdentifier) {
    config.macos.bundleIdentifier = props.bundleIdentifier;
  }

  return withPlugins(config, [
    [withMacosDisplayName, props],
    withAssociatedDomains,
    withMacosJsEnginePodfileProps,
  ]);
}

module.exports = { projectHasMacosNativeTree, withMacosExpoPlugins };
