const { withDisplayName: withDisplayNameIos } = require("../ios/Name");

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string; }>}
 */
module.exports = function withExpoIos(config, props) {
  // Same-named mods do not clash, as they are stored by platform first, then
  // mod name (`config.mods[platform][mod]`):
  // https://github.com/expo/expo/blob/9999e24657faffc6536bc3ec95efe9ecfc055fae/packages/%40expo/config-plugins/src/plugins/withMod.ts#L56-L60
  config = withDisplayNameIos(config, props);

  return config;
};
