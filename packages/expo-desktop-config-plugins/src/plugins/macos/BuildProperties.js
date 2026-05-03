/**
 * Based on `@expo/config-plugins` BuildProperties.ts (macOS Podfile.properties mod + `macos`-aware `withJsEnginePodfileProps`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/BuildProperties.ts
 */

const macosPlugins = require("./macos-plugins");

/**
 * Creates a `withPodfileProperties` config-plugin based on given config to property mapping rules.
 *
 * Mirrors Expo’s factory: when mapping from full `ExpoConfig`, callers use `ConfigPlugin<void>`
 * (`sourceConfig` is taken from `config`).
 *
 * @template {import("@expo/config-plugins/build/utils/BuildProperties.types").BuildPropertiesConfig} SourceConfigType
 * @param {import("@expo/config-plugins/build/utils/BuildProperties.types").ConfigToPropertyRuleType<SourceConfigType>[]} configToPropertyRules config to property mapping rules
 * @param {string} [name] the config plugin name
 * @returns {import("@expo/config-plugins").ConfigPlugin<void | SourceConfigType>}
 */
function createBuildPodfilePropsConfigPlugin(configToPropertyRules, name) {
  const withUnknown = (config, sourceConfig) =>
    macosPlugins.withPodfileProperties(config, async (cfg) => {
      cfg.modResults = updateMacosBuildPropertiesFromConfig(
        sourceConfig ?? cfg,
        cfg.modResults,
        configToPropertyRules,
      );
      return cfg;
    });
  if (name) {
    Object.defineProperty(withUnknown, "name", {
      value: name,
    });
  }
  return withUnknown;
}

/**
 * A config-plugin to update `macos/Podfile.properties.json` from the `jsEngine` in expo config (`macos.jsEngine`, then root `jsEngine`, then `hermes`).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<void>}
 */
const withJsEnginePodfileProps = createBuildPodfilePropsConfigPlugin(
  [
    {
      propName: "expo.jsEngine",
      propValueGetter: (config) => config.macos?.jsEngine ?? config.jsEngine ?? "hermes",
    },
  ],
  "withJsEnginePodfileProps",
);

/**
 * @template {import("@expo/config-plugins/build/utils/BuildProperties.types").BuildPropertiesConfig} SourceConfigType
 * @param {SourceConfigType} config
 * @param {Record<string, string>} podfileProperties
 * @param {import("@expo/config-plugins/build/utils/BuildProperties.types").ConfigToPropertyRuleType<SourceConfigType>[]} configToPropertyRules
 * @returns {Record<string, string>}
 */
function updateMacosBuildPropertiesFromConfig(config, podfileProperties, configToPropertyRules) {
  for (const configToProperty of configToPropertyRules) {
    const value = configToProperty.propValueGetter(config);
    updateMacosBuildProperty(podfileProperties, configToProperty.propName, value);
  }
  return podfileProperties;
}

/**
 * @param {Record<string, string>} podfileProperties
 * @param {string} name
 * @param {string | null | undefined} value
 * @param {{ removePropWhenValueIsNull?: boolean }} [options]
 * @returns {Record<string, string>}
 */
function updateMacosBuildProperty(podfileProperties, name, value, options) {
  if (value) {
    podfileProperties[name] = value;
  } else if (options?.removePropWhenValueIsNull) {
    delete podfileProperties[name];
  }
  return podfileProperties;
}

exports.createBuildPodfilePropsConfigPlugin = createBuildPodfilePropsConfigPlugin;
exports.updateMacosBuildPropertiesFromConfig = updateMacosBuildPropertiesFromConfig;
exports.updateMacosBuildProperty = updateMacosBuildProperty;
exports.withJsEnginePodfileProps = withJsEnginePodfileProps;
