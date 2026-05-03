const { withInfoPlist } = require("./macos-plugins");
const { addWarningMacOS } = require("./_utils/warnings");

/**
 * @see https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/ios/Name.ts#L11
 */
const withDisplayName = createInfoPlistPluginWithPropertyGuard(
  setDisplayName,
  {
    infoPlistProperty: "CFBundleDisplayName",
    expoConfigProperty: "name",
  },
  "withDisplayName",
);
module.exports.withDisplayName = withDisplayName;

/**
 * @typedef {Parameters<import("@expo/config-plugins").ConfigPlugin>[0]} ExpoConfig
 * @typedef {import("@expo/config-plugins").InfoPlist} InfoPlist
 * @typedef {( expo: ExpoConfig, infoPlist: InfoPlist ) => Promise<InfoPlist> | InfoPlist} MutateInfoPlistAction
 */

/**
 * CFBundleDisplayName is used for most things: the name on the home screen, in
 * notifications, and others.
 * @param {Pick<ExpoConfig, 'name'> | string} configOrName
 * @param {InfoPlist} infoPlist
 * @returns {InfoPlist}
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/config-plugins/src/ios/Name.ts#L45
 */
function setDisplayName(configOrName, { CFBundleDisplayName, ...infoPlist }) {
  /** @type {string | null} */
  let name = null;
  if (typeof configOrName === "string") {
    name = configOrName;
  } else {
    name = getName(configOrName);
  }

  if (!name) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleDisplayName: name,
  };
}
module.exports.setDisplayName = setDisplayName;

/**
 * @param {MutateInfoPlistAction} action
 * @param {{ infoPlistProperty: string; expoConfigProperty: string; expoPropertyGetter?: (config: ExpoConfig) => string;}} settings
 * @param {string} [configPluginName]
 * @returns {import("@expo/config-plugins").ConfigPlugin<{ displayName: string }>}
 *
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/config-plugins/src/plugins/ios-plugins.ts#L36
 */
function createInfoPlistPluginWithPropertyGuard(action, settings, configPluginName) {
  /** @type {import("@expo/config-plugins").ConfigPlugin<{ displayName: string }>} */
  const withUnknown = (config, props) =>
    withInfoPlist(config, async (config) => {
      const existingProperty = settings.expoPropertyGetter
        ? settings.expoPropertyGetter(config)
        : get(config, settings.expoConfigProperty);
      // If the user explicitly sets a value in the infoPlist, we should respect that.
      if (config.modRawConfig.macos?.infoPlist?.[settings.infoPlistProperty] === undefined) {
        // config.modResults = await action(config, config.modResults);
        config.modResults = await action(props.displayName, config.modResults);
      } else if (existingProperty !== undefined) {
        // Only warn if there is a conflict.
        addWarningMacOS(
          settings.expoConfigProperty,
          `"macos.infoPlist.${settings.infoPlistProperty}" is set in the config. Ignoring abstract property "${settings.expoConfigProperty}": ${existingProperty}`,
        );
      }

      return config;
    });
  if (configPluginName) {
    Object.defineProperty(withUnknown, "name", {
      value: configPluginName,
    });
  }
  return withUnknown;
}

/**
 * @param {any} obj
 * @param {string} key
 * @returns {any}
 *
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/config-plugins/src/utils/obj.ts#L2
 */
function get(obj, key) {
  const branches = key.split(".");
  /** @type {any} */
  let current = obj;
  /** @type {string | undefined} */
  let branch;
  while ((branch = branches.shift())) {
    if (!(branch in current)) {
      return undefined;
    }
    current = current[branch];
  }
  return current;
}
