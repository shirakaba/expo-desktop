const { withIosBaseMods } = require("@expo/config-plugins/build/plugins/withIosBaseMods");
const { withAndroidBaseMods } = require("@expo/config-plugins/build/plugins/withAndroidBaseMods");
const { withMacosBaseMods } = require("./macos/withMacosBaseMods");

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {import("@expo/config-plugins/build/plugins/createBaseMod").ForwardedBaseModOptions} [props={}]
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withDefaultBaseMods(config, props = {}) {
  config = withIosBaseMods(config, props);
  config = withAndroidBaseMods(config, props);
  config = withMacosBaseMods(config, props);
  return config;
}
module.exports.withDefaultBaseMods = withDefaultBaseMods;

// TODO: withIntrospectionBaseMods()
// https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L29

// TODO: compileModsAsync()
// https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L69

// TODO: evalModsAsync()
// https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/config-plugins/src/plugins/mod-compiler.ts#L126
