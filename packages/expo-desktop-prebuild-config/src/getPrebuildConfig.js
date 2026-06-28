const { getConfig } = require("@expo/config");

const { getAutolinkedPackagesAsync } = require("./getAutolinkedPackages");
const {
  withAndroidExpoPlugins,
  withIosExpoPlugins,
  withLegacyExpoPlugins,
  withVersionedExpoSDKPlugins,
} = require("@expo/prebuild-config/build/plugins/withDefaultPlugins");
const { withMacosExpoPlugins, withWindowsExpoPlugins } = require("./withDefaultPlugins");

/**
 * @typedef {{ displayName?: string | undefined; bundleIdentifier?: string | undefined; bundleIdentifierIos?: string | undefined; bundleIdentifierMacos?: string | undefined; packageName?: string | undefined; windowsNamespace?: string | undefined; platforms: Array<import('@expo/config-plugins').ModPlatform | "macos" | "windows">; bundleEntryFileCandidates?: Array<string> | undefined; }} PrebuildConfigProps
 */

/**
 * @param {string} projectRoot
 * @param {PrebuildConfigProps} props
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
 * @param {PrebuildConfigProps & { autolinkedModules?: Array<string>; }} props
 * @returns {Promise<ReturnType<typeof getConfig>>}
 */
function getPrebuildConfig(
  projectRoot,
  {
    platforms,
    displayName,
    bundleIdentifier,
    bundleIdentifierIos = bundleIdentifier,
    bundleIdentifierMacos = bundleIdentifier,
    packageName,
    windowsNamespace,
    bundleEntryFileCandidates,
    autolinkedModules,
  },
) {
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

  /** @type {string} */
  let resolvedBundleIdentifierIos;
  if (platforms.includes("ios")) {
    if (!config.ios) config.ios = {};
    resolvedBundleIdentifierIos =
      bundleIdentifierIos ?? config.ios.bundleIdentifier ?? `com.placeholder.appid`;
    config.ios.bundleIdentifier = resolvedBundleIdentifierIos;

    // Add all built-in plugins
    config = withIosExpoPlugins(config, {
      bundleIdentifier: resolvedBundleIdentifierIos,
    });
  }

  if (platforms.includes("macos")) {
    if (!config.macos) config.macos = {};
    /** @type {string} */
    let resolvedBundleIdentifierMacos =
      bundleIdentifierMacos ??
      config.macos.bundleIdentifier ??
      resolvedBundleIdentifierIos ??
      `com.placeholder.appid`;
    config.macos.bundleIdentifier = resolvedBundleIdentifierMacos;

    // Add all built-in plugins
    config = withMacosExpoPlugins(config, {
      bundleIdentifier: resolvedBundleIdentifierMacos,
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

  if (platforms.includes("windows")) {
    if (!config.windows) config.windows = {};
    config.windows.namespace =
      windowsNamespace ?? config.windows.namespace ?? `com.placeholder.appid`;

    config = withWindowsExpoPlugins(config, {
      displayName,
      bundleEntryFileCandidates,
    });
  }

  return { exp: config, ...rest };
}
