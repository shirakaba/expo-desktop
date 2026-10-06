const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig: makeRnxKitMetroConfig } = require("@rnx-kit/metro-config");

/**
 * @param {Parameters<import("@expo/metro-config").getDefaultConfig>} args
 * @return {ReturnType<import("@rnx-kit/metro-config").makeMetroConfig>}
 */
function makeMetroConfig(...args) {
  return makeRnxKitMetroConfig(getDefaultConfig(...args));
}

module.exports.makeMetroConfig = makeMetroConfig;
