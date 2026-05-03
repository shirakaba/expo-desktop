const { getConfig } = require("@expo/config");

const { getAutolinkedPackagesAsync } = require("./getAutolinkedPackages");
const {
  withAndroidExpoPlugins,
  withIosExpoPlugins,
  withLegacyExpoPlugins,
  withVersionedExpoSDKPlugins,
} = require("@expo/prebuild-config/build/plugins/withDefaultPlugins");
const { withMacosExpoPlugins } = require("./withDefaultPlugins");

/**
 * @param {string} projectRoot
 * @param {{ displayName?: string; bundleIdentifier?: string; packageName?: string; platforms: Array<import('@expo/config-plugins').ModPlatform>; }} props
 * @returns {Promise<ReturnType<typeof getConfig>>}
 *
 * @see https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/prebuild-config/src/getPrebuildConfig.ts#L12
 */
async function getPrebuildConfigAsync(projectRoot, props) {
  const autolinkedModules = await getAutolinkedPackagesAsync(projectRoot, props.platforms);

  return getPrebuildConfig(projectRoot, {
    ...props,
    autolinkedModules,
  });
}
module.exports.getPrebuildConfigAsync = getPrebuildConfigAsync;

/**
 * @param {string} projectRoot
 * @param {{ displayName?: string; bundleIdentifier?: string; packageName?: string; platforms: Array<import('@expo/config-plugins').ModPlatform>; autolinkedModules?: Array<string> }} props
 * @returns {Promise<ReturnType<typeof getConfig>>}
 */
function getPrebuildConfig(
  projectRoot,
  { platforms, displayName, bundleIdentifier, packageName, autolinkedModules },
) {
  // let config: ExpoConfig;
  let { exp: config, ...rest } = getConfig(projectRoot, {
    skipSDKVersionRequirement: true,
    isModdedConfig: true,
  });

  if (autolinkedModules) {
    if (!config._internal) {
      config._internal = {};
    }
    config._internal.autolinkedModules = autolinkedModules;
  }

  // Add all built-in plugins first because they should take
  // priority over the unversioned plugins.
  config = withVersionedExpoSDKPlugins(config);
  config = withLegacyExpoPlugins(config);

  if (platforms.includes("ios")) {
    if (!config.ios) config.ios = {};
    config.ios.bundleIdentifier =
      bundleIdentifier ?? config.ios.bundleIdentifier ?? `com.placeholder.appid`;

    // Add all built-in plugins
    config = withIosExpoPlugins(config, {
      bundleIdentifier: config.ios.bundleIdentifier,
    });
  }

  if (platforms.includes("macos")) {
    if (!config.macos) config.macos = {};
    config.macos.bundleIdentifier =
      bundleIdentifier ?? config.macos.bundleIdentifier ?? `com.placeholder.appid`;

    // Add all built-in plugins
    config = withMacosExpoPlugins(config, {
      bundleIdentifier: config.macos.bundleIdentifier,
      displayName,
    });
  }

  if (platforms.includes("android")) {
    if (!config.android) config.android = {};
    config.android.package = packageName ?? config.android.package ?? `com.placeholder.appid`;

    // Add all built-in plugins
    config = withAndroidExpoPlugins(config, {
      package: config.android.package,
      projectRoot,
    });
  }

  return { exp: config, ...rest };
}
