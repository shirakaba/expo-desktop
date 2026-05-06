const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig } = require("@rnx-kit/metro-config");

const defaultConfig = getDefaultConfig(__dirname);
module.exports = makeMetroConfig({
  ...defaultConfig,
  serializer: {
    ...defaultConfig.serializer,
    getPolyfills: () => {
      console.log("getPolyfills()");
      const polyfills = require("@react-native/js-polyfills")();
      polyfills.push(require.resolve("./expo.polyfill.js"));
      return polyfills;
    },
  },
});
