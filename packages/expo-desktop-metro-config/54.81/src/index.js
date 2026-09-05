const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig: makeRnxKitMetroConfig } = require("@rnx-kit/metro-config");

/**
 * @param {Parameters<import("@expo/metro-config").getDefaultConfig>} args
 * @return {ReturnType<import("@rnx-kit/metro-config").makeMetroConfig>}
 */
function makeMetroConfig(...args) {
  const config = makeRnxKitMetroConfig(getDefaultConfig(...args));
  config.resolver.platforms = ["ios", "android", "macos", "windows", "web"];
  return config;
}

module.exports.makeMetroConfig = makeMetroConfig;
