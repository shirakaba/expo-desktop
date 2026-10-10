const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig: makeRnxKitMetroConfig } = require("@rnx-kit/metro-config");
const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {Parameters<import("@expo/metro-config").getDefaultConfig>} args
 * @return {ReturnType<import("@rnx-kit/metro-config").makeMetroConfig>}
 */
function makeMetroConfig(...args) {
  const config = makeRnxKitMetroConfig(getDefaultConfig(...args));
  const blockList = config.resolver.blockList;
  const nativeBuildDirectories = [path.join(config.projectRoot, "windows")];

  let rnwPackage;
  try {
    rnwPackage = require.resolve("react-native-windows/package.json", {
      paths: [config.projectRoot],
    });
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
  }
  if (rnwPackage) {
    const rnwRoot = fs.realpathSync(path.dirname(rnwPackage));
    nativeBuildDirectories.push(path.join(rnwRoot, "build"), path.join(rnwRoot, "target"));
  }

  // Match RNW's template exclusions. Watching MSBuild outputs can overwhelm
  // Metro's Windows watcher during a rebuild or hit files locked by MSBuild.
  config.resolver.blockList = [
    ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
    ...nativeBuildDirectories.map(directoryPattern),
    /\.ProjectImports\.zip$/,
  ];
  // RNX Kit sets this legacy alias, which Metro prioritizes over blockList.
  // Remove it so these exclusions and later user additions take effect.
  delete config.resolver.blacklistRE;
  return config;
}

function directoryPattern(directory) {
  const escapedPath = directory
    .split(/[/\\]/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[/\\\\]");
  return new RegExp(`^${escapedPath}(?:[/\\\\].*)?$`);
}

module.exports.makeMetroConfig = makeMetroConfig;
