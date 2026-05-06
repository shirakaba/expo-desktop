const Debug = require("debug");
const path = require("node:path");
const { assertModResults } = require("@expo/config-plugins/build/plugins/createBaseMod");
const { withAndroidBaseMods } = require("@expo/config-plugins/build/plugins/withAndroidBaseMods");
const { withIosBaseMods } = require("@expo/config-plugins/build/plugins/withIosBaseMods");
const { withMacosBaseMods } = require("./macos/withMacosBaseMods");
const { withWindowsBaseMods } = require("./windows/withWindowsBaseMods");
const { getHackyProjectName } = require("./macos/Xcodeproj");
const { sortMods } = require("@expo/config-plugins/build/plugins/mod-compiler");
const { PluginError } = require("@expo/config-plugins");
const { addWarningForPlatform } = require("./macos/_utils/warnings");

const debug = Debug("expo-desktop:config-plugins:mod-compiler");

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {import("@expo/config-plugins/build/plugins/createBaseMod").ForwardedBaseModOptions} [props={}]
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withDefaultBaseMods(config, props = {}) {
  config = withIosBaseMods(config, props);
  config = withAndroidBaseMods(config, props);
  config = withMacosBaseMods(config, props);
  config = withWindowsBaseMods(config, props);
  return config;
}
module.exports.withDefaultBaseMods = withDefaultBaseMods;

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {{ projectRoot: string; platforms?: Array<import("@expo/config-plugins").ModPlatform>; introspect?: boolean; assertMissingModProviders?: boolean; ignoreExistingNativeFiles?: boolean; }} props
 * @returns {Promise<import("@expo/config-plugins").ExportedConfig>}
 */
async function compileModsAsync(config, props) {
  if (props.introspect === true) {
    config = withIntrospectionBaseMods(config);
  } else {
    config = withDefaultBaseMods(config);
  }
  return await evalModsAsync(config, props);
}
module.exports.compileModsAsync = compileModsAsync;

/**
 * Get a prebuild config that safely evaluates mods without persisting any
 * changes to the file system.
 *
 * Currently this only supports infoPlist, entitlements, androidManifest,
 * strings, gradleProperties, and expoPlist mods.
 *
 * This plugin should be evaluated directly:
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {import("@expo/config-plugins/build/plugins/createBaseMod").ForwardedBaseModOptions} [props={}]
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withIntrospectionBaseMods(config, props = {}) {
  config = withIosBaseMods(config, {
    saveToInternal: true,
    // This writing optimization can be skipped since we never write in
    // introspection mode.
    // Including empty mods will ensure that all mods get introspected.
    skipEmptyMod: false,
    ...props,
  });
  config = withMacosBaseMods(config, {
    saveToInternal: true,
    // This writing optimization can be skipped since we never write in
    // introspection mode.
    // Including empty mods will ensure that all mods get introspected.
    skipEmptyMod: false,
    ...props,
  });
  config = withAndroidBaseMods(config, {
    saveToInternal: true,
    skipEmptyMod: false,
    ...props,
  });
  config = withWindowsBaseMods(config, {
    saveToInternal: true,
    skipEmptyMod: false,
    ...props,
  });

  if (config.mods) {
    // Remove all mods that don't have an introspection base mod, for instance
    // `dangerous` mods.
    for (const platform of Object.keys(config.mods)) {
      // const platformPreserve = preserve[platform];
      for (const key of Object.keys(config.mods[platform] || {})) {
        // @ts-ignore
        if (!config.mods[platform]?.[key]?.isIntrospective) {
          debug(`removing non-idempotent mod: ${platform}.${key}`);
          // @ts-ignore
          delete config.mods[platform]?.[key];
        }
      }
    }
  }

  return config;
}
module.exports.withIntrospectionBaseMods = withIntrospectionBaseMods;

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 */
function getRawClone({ mods, ...config }) {
  // Configs should be fully serializable, so we can clone them without worrying about
  // the mods.
  return Object.freeze(JSON.parse(JSON.stringify(config)));
}

/** @type {Record<string, Record<string, number>>} */
const precedences = {
  ios: {
    // dangerous runs first
    dangerous: -2,
    // run the XcodeProject mod second because many plugins attempt to read from it.
    xcodeproj: -1,
    // put the finalized mod at the last
    finalized: 1,
  },
  macos: {
    // dangerous runs first
    dangerous: -2,
    // run the XcodeProject mod second because many plugins attempt to read from it.
    xcodeproj: -1,
    // put the finalized mod at the last
    finalized: 1,
  },
  windows: {
    dangerous: -2,
    finalized: 1,
  },
};

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {{ projectRoot: string; platforms?: Array<import("@expo/config-plugins").ModPlatform>; introspect?: boolean; assertMissingModProviders?: boolean; ignoreExistingNativeFiles?: boolean; }} props
 * @returns {Promise<import("@expo/config-plugins").ExportedConfig>}
 */
async function evalModsAsync(
  config,
  {
    projectRoot,
    introspect,
    platforms,
    assertMissingModProviders,
    ignoreExistingNativeFiles = false,
  },
) {
  const modRawConfig = getRawClone(config);
  for (const [platformName, platform] of Object.entries(config.mods ?? {})) {
    if (platforms && !platforms.includes(platformName)) {
      debug(`skip platform: ${platformName}`);
      continue;
    }

    let entries = Object.entries(platform);
    if (entries.length) {
      // Move dangerous item to the first position and finalized item to the last position if it exists.
      // This ensures that all dangerous code runs first and finalized applies last.
      entries = sortMods(entries, precedences[platformName] ?? { dangerous: -1, finalized: 1 });
      debug(`run in order: ${entries.map(([name]) => name).join(", ")}`);
      const platformProjectRoot = path.join(projectRoot, platformName);
      const projectName =
        platformName === "ios" ? getHackyProjectName(projectRoot, config) : undefined;

      for (const [modName, mod] of entries) {
        const modRequest = {
          projectRoot,
          projectName,
          platformProjectRoot,
          platform: platformName,
          modName,
          introspect: !!introspect,
          ignoreExistingNativeFiles,
        };

        if (!mod.isProvider) {
          // In strict mode, throw an error.
          const errorMessage = `Initial base modifier for "${platformName}.${modName}" is not a provider and therefore will not provide modResults to child mods`;
          if (assertMissingModProviders !== false) {
            throw new PluginError(errorMessage, "MISSING_PROVIDER");
          } else {
            addWarningForPlatform(
              platformName,
              `${platformName}.${modName}`,
              `Skipping: Initial base modifier for "${platformName}.${modName}" is not a provider and therefore will not provide modResults to child mods. This may be due to an outdated version of Expo CLI.`,
            );
            // In loose mode, just skip the mod entirely.
            continue;
          }
        }

        const results = await mod({
          ...config,
          modResults: null,
          modRequest,
          modRawConfig,
        });

        // Sanity check to help locate non compliant mods.
        config = assertModResults(results, platformName, modName);
        // @ts-ignore: `modResults` is added for modifications
        delete config.modResults;
        // @ts-ignore: `modRequest` is added for modifications
        delete config.modRequest;
        // @ts-ignore: `modRawConfig` is added for modifications
        delete config.modRawConfig;
      }
    }
  }

  return config;
}
module.exports.evalModsAsync = evalModsAsync;
