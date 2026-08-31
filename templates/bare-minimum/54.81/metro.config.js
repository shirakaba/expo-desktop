const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig } = require("@rnx-kit/metro-config");

const config = makeMetroConfig(getDefaultConfig(__dirname));
config.resolver.platforms = ["ios", "android", "macos", "windows", "web"];
module.exports = config;
