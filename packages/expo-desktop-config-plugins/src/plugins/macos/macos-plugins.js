const { withMod } = require("@expo/config-plugins");
const obj = require("@expo/config-plugins/build/utils/obj");
const warnings = require("./_utils/warnings");

function createInfoPlistPlugin(action, name) {
  const withUnknown = (config) =>
    withInfoPlist(config, async (config) => {
      config.modResults = await action(config, config.modResults);
      return config;
    });
  if (name) {
    Object.defineProperty(withUnknown, "name", {
      value: name,
    });
  }
  return withUnknown;
}

/**
 * @param {MutateInfoPlistAction} action
 * @param {{ infoPlistProperty: string; expoConfigProperty: string; expoPropertyGetter?: (config: import("@expo/config-types").ExpoConfig) => string;}} settings
 * @param {string} [name] the name of the config plugin
 * @returns {import("@expo/config-plugins").ConfigPlugin}
 *
 * @see https://github.com/expo/expo/blob/870dcba2ade9572fc279f0a47bfbdd78af4a236d/packages/%40expo/config-plugins/src/plugins/ios-plugins.ts#L36
 */
function createInfoPlistPluginWithPropertyGuard(action, settings, name) {
  const withUnknown = (config) =>
    withInfoPlist(config, async (config) => {
      const existingProperty = settings.expoPropertyGetter
        ? settings.expoPropertyGetter(config)
        : obj.get(config, settings.expoConfigProperty);
      if (config.modRawConfig.macos?.infoPlist?.[settings.infoPlistProperty] === undefined) {
        config.modResults = await action(config, config.modResults);
      } else if (existingProperty !== undefined) {
        warnings.addWarningMacOS(
          settings.expoConfigProperty,
          `"macos.infoPlist.${settings.infoPlistProperty}" is set in the config. Ignoring abstract property "${settings.expoConfigProperty}": ${existingProperty}`,
        );
      }
      return config;
    });
  if (name) {
    Object.defineProperty(withUnknown, "name", {
      value: name,
    });
  }
  return withUnknown;
}

function createEntitlementsPlugin(action, name) {
  const withUnknown = (config) =>
    withEntitlementsPlist(config, async (config) => {
      config.modResults = await action(config, config.modResults);
      return config;
    });
  if (name) {
    Object.defineProperty(withUnknown, "name", {
      value: name,
    });
  }
  return withUnknown;
}

const withAppDelegate = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "appDelegate",
    action,
  });
};

const withMacOSDangerous = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "dangerous",
    action,
  });
};

const withMacOSViewController = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "viewController",
    action,
  });
};

const withInfoPlist = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "infoPlist",
    async action(config) {
      config = await action(config);
      if (!config.macos) {
        config.macos = {};
      }
      config.macos.infoPlist = config.modResults;
      return config;
    },
  });
};

const withEntitlementsPlist = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "entitlements",
    async action(config) {
      config = await action(config);
      if (!config.macos) {
        config.macos = {};
      }
      config.macos.entitlements = config.modResults;
      return config;
    },
  });
};

const withExpoPlist = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "expoPlist",
    action,
  });
};

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<import("@expo/config-plugins").Mod<import("xcode").XcodeProject>>}
 */
const withXcodeProject = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "xcodeproj",
    action,
  });
};

const withPodfile = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "podfile",
    action,
  });
};

const withPodfileProperties = (config, action) => {
  return withMod(config, {
    platform: "macos",
    mod: "podfileProperties",
    action,
  });
};

exports.createEntitlementsPlugin = createEntitlementsPlugin;
exports.createInfoPlistPlugin = createInfoPlistPlugin;
exports.createInfoPlistPluginWithPropertyGuard = createInfoPlistPluginWithPropertyGuard;
exports.withAppDelegate = withAppDelegate;
exports.withEntitlementsPlist = withEntitlementsPlist;
exports.withExpoPlist = withExpoPlist;
exports.withInfoPlist = withInfoPlist;
exports.withMacOSDangerous = withMacOSDangerous;
exports.withMacOSViewController = withMacOSViewController;
exports.withPodfile = withPodfile;
exports.withPodfileProperties = withPodfileProperties;
exports.withXcodeProject = withXcodeProject;
