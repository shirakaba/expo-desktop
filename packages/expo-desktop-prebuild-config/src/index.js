const { getAutolinkedPackagesAsync } = require("./getAutolinkedPackages");
module.exports.getAutolinkedPackagesAsync = getAutolinkedPackagesAsync;

const { getPrebuildConfigAsync } = require("./getPrebuildConfig");
module.exports.getPrebuildConfigAsync = getPrebuildConfigAsync;

const {
  getAutoPlugins,
  getLegacyExpoPlugins,
  projectHasMacosNativeTree,
  withAndroidExpoPlugins,
  withIosExpoPlugins,
  withLegacyExpoPlugins,
  withMacosExpoPlugins,
  withVersionedExpoSDKPlugins,
} = require("./withDefaultPlugins");
module.exports.getAutoPlugins = getAutoPlugins;
module.exports.getLegacyExpoPlugins = getLegacyExpoPlugins;
module.exports.projectHasMacosNativeTree = projectHasMacosNativeTree;
module.exports.withAndroidExpoPlugins = withAndroidExpoPlugins;
module.exports.withIosExpoPlugins = withIosExpoPlugins;
module.exports.withLegacyExpoPlugins = withLegacyExpoPlugins;
module.exports.withMacosExpoPlugins = withMacosExpoPlugins;
module.exports.withVersionedExpoSDKPlugins = withVersionedExpoSDKPlugins;
