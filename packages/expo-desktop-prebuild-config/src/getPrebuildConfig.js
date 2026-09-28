const { getConfig } = require("@expo/config");
const crypto = require("node:crypto");

const { getAutolinkedPackagesAsync } = require("./getAutolinkedPackages");
const {
  withAndroidExpoPlugins,
  withIosExpoPlugins,
  withMacosExpoPlugins,
  withWindowsExpoPlugins,
  withLegacyExpoPlugins,
  withVersionedExpoSDKPlugins,
} = require("./withDefaultPlugins");

/**
 * @typedef {{ displayName?: string | undefined; filesafeName?: string | undefined; bundleIdentifier?: string | undefined; bundleIdentifierIos?: string | undefined; bundleIdentifierMacos?: string | undefined; packageName?: string | undefined; windowsNamespace?: string | undefined; windowsPackageGuid?: string | undefined; windowsProjectGuid?: string | undefined; platforms: Array<import('@expo/config-plugins').ModPlatform | "macos" | "windows">; bundleEntryFileCandidates?: Array<string> | undefined; }} PrebuildConfigProps
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
    autolinkedModules,
    bundleEntryFileCandidates,
    bundleIdentifier,
    bundleIdentifierIos = bundleIdentifier,
    bundleIdentifierMacos = bundleIdentifier,
    displayName,
    filesafeName,
    packageName,
    platforms,
    windowsNamespace,
    windowsPackageGuid,
    windowsProjectGuid,
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

    /** @type {string} */
    const resolvedDisplayNameIos =
      displayName ??
      config.ios.infoPlist?.CFBundleName ??
      config.macos.infoPlist?.CFBundleName ??
      config.name;

    // Add all built-in plugins
    config = withIosExpoPlugins(config, {
      bundleIdentifier: resolvedBundleIdentifierIos,
      displayName: resolvedDisplayNameIos,
    });
  }

  if (platforms.includes("macos")) {
    if (!config.macos) config.macos = {};

    if (!config.experiments) {
      config.experiments = {};
    }
    // Needed, otherwise "macos" and "windows" just get filtered out of
    // config.platforms by getPlatformsFromConfig() in @expo/config.
    // https://github.com/expo/expo/pull/46497
    config.experiments.outOfTreePlatforms = true;

    /** @type {string} */
    const resolvedBundleIdentifierMacos =
      bundleIdentifierMacos ??
      config.macos.bundleIdentifier ??
      resolvedBundleIdentifierIos ??
      `com.placeholder.appid`;
    config.macos.bundleIdentifier = resolvedBundleIdentifierMacos;

    /** @type {string} */
    const resolvedDisplayNameMacos =
      displayName ??
      config.macos.infoPlist?.CFBundleName ??
      config.ios.infoPlist?.CFBundleName ??
      config.name;
    if (!config.macos.infoPlist) {
      config.macos.infoPlist = {};
    }
    config.macos.infoPlist.CFBundleName = resolvedDisplayNameMacos;

    // Add all built-in plugins
    config = withMacosExpoPlugins(config, {
      bundleIdentifier: resolvedBundleIdentifierMacos,
      displayName: resolvedDisplayNameMacos,
      filesafeName,
    });
  }

  if (platforms.includes("android")) {
    if (!config.android) config.android = {};
    config.android.package = packageName ?? config.android.package ?? `com.placeholder.appid`;

    /**
     * There is no canonical config.android property to persist displayName
     * into, so although we can fill it in on the initial app creation (while we
     * still have the --display-name choice in memory), it'll be lost on the
     * next clean prebuild.
     *
     * One option would be to populate the plugins array and persist it into the
     * "expo-desktop" plugin's props, but I'd rather avoid that as far as
     * possible, as it exposes yet another source of truth for these already
     * complicated multi-truth config plugins.
     *
     * So instead, we'll just say that until upstream supports display name for
     * Android, users will have to roll their own Android display name plugin
     * as they always have, or use our withExpoAndroid plugin. So although we
     * resolve a display name prop here, we don't actually use it.
     *
     * @type {string}
     */
    const resolvedDisplayNameAndroid = displayName ?? config.name;

    // Add all built-in plugins
    config = withAndroidExpoPlugins(config, {
      displayName: resolvedDisplayNameAndroid,
      package: config.android.package,
      projectRoot,
    });
  }

  if (platforms.includes("windows")) {
    if (!config.windows) config.windows = {};
    if (!config.experiments) {
      config.experiments = {};
    }
    config.experiments.outOfTreePlatforms = true;

    /** @type {string} */
    const resolvedNamespace =
      windowsNamespace ?? config.windows.namespace ?? `com.placeholder.appid`;
    config.windows.namespace = resolvedNamespace;

    /** @type {string} */
    const resolvedProjectGuid =
      windowsProjectGuid ?? config.windows.projectGuid ?? crypto.randomUUID();
    config.windows.projectGuid = resolvedProjectGuid;

    /** @type {string} */
    const resolvedPackageGuid =
      windowsPackageGuid ?? config.windows.packageGuid ?? crypto.randomUUID();
    config.windows.packageGuid = resolvedPackageGuid;

    /** @type {string} */
    const resolvedDisplayName = displayName ?? config.windows.displayName ?? config.name;
    config.windows.displayName = resolvedDisplayName;

    config = withWindowsExpoPlugins(config, {
      displayName: resolvedDisplayName,
      filesafeName,
      bundleEntryFileCandidates,
      windowsNamespace: resolvedNamespace,
      windowsPackageGuid: resolvedPackageGuid,
      windowsProjectGuid: resolvedProjectGuid,
    });
  }

  return { exp: config, ...rest };
}
