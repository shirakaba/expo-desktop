const { withPodfileProperties } = require("./macos-plugins");

/**
 * Mirrors iOS `withJsEnginePodfileProps` for `macos/Podfile.properties.json`.
 *
 * @type {import("@expo/config-plugins").ConfigPlugin}
 */
function withMacosJsEnginePodfileProps(config) {
  const engine = config.jsEngine;
  if (!engine) {
    return config;
  }

  return withPodfileProperties(config, async (config) => {
    config.modResults["expo.jsEngine"] = engine;
    return config;
  });
}

module.exports = { withMacosJsEnginePodfileProps };
