const { createInfoPlistPluginWithPropertyGuard } = require("./macos-plugins");

const withScheme = createInfoPlistPluginWithPropertyGuard(
  setScheme,
  {
    infoPlistProperty: "CFBundleURLTypes",
    expoConfigProperty: "scheme",
  },
  "withScheme",
);
module.exports.withScheme = withScheme;

/**
 * @param {Partial<Pick<import("@expo/config-types").ExpoConfig, "scheme">>} config
 * @returns {Array<string>}
 */
function getScheme(config) {
  if (Array.isArray(config.scheme)) {
    const validate = (value) => {
      return typeof value === "string";
    };
    return config.scheme.filter < string > validate;
  } else if (typeof config.scheme === "string") {
    return [config.scheme];
  }
  return [];
}
module.exports.getScheme = getScheme;

/**
 * @param {Partial<Pick<import("@expo/config-types").ExpoConfig, "scheme" | "macos">>} config
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @returns {import("@expo/config-plugins").InfoPlist}
 */
function setScheme(config, infoPlist) {
  const scheme = [...getScheme(config), ...getScheme(config.macos ?? {})];
  // Add the bundle identifier to the list of schemes for easier Google auth and parity with Turtle v1.
  if (config.macos?.bundleIdentifier) {
    scheme.push(config.macos.bundleIdentifier);
  }
  if (scheme.length === 0) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleURLTypes: [{ CFBundleURLSchemes: scheme }],
  };
}
module.exports.setScheme = setScheme;

/**
 * @param {string | null} scheme
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @returns {import("@expo/config-plugins").InfoPlist}
 */
function appendScheme(scheme, infoPlist) {
  if (!scheme) {
    return infoPlist;
  }

  const existingSchemes = infoPlist.CFBundleURLTypes ?? [];
  if (existingSchemes?.some(({ CFBundleURLSchemes }) => CFBundleURLSchemes.includes(scheme))) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleURLTypes: [
      ...existingSchemes,
      {
        CFBundleURLSchemes: [scheme],
      },
    ],
  };
}
module.exports.appendScheme = appendScheme;

/**
 * @param {string | null} scheme
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @returns {import("@expo/config-plugins").InfoPlist}
 */
function removeScheme(scheme, infoPlist) {
  if (!scheme) {
    return infoPlist;
  }

  // No need to remove if we don't have any
  if (!infoPlist.CFBundleURLTypes) {
    return infoPlist;
  }

  infoPlist.CFBundleURLTypes = infoPlist.CFBundleURLTypes.map((bundleUrlType) => {
    const index = bundleUrlType.CFBundleURLSchemes.indexOf(scheme);
    if (index > -1) {
      bundleUrlType.CFBundleURLSchemes.splice(index, 1);
      if (bundleUrlType.CFBundleURLSchemes.length === 0) {
        return undefined;
      }
    }
    return bundleUrlType;
  }).filter(Boolean);

  return infoPlist;
}
module.exports.removeScheme = removeScheme;

/**
 * @param {string} scheme
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @returns {boolean}
 */
function hasScheme(scheme, infoPlist) {
  const existingSchemes = infoPlist.CFBundleURLTypes;

  if (!Array.isArray(existingSchemes)) return false;

  return existingSchemes?.some(({ CFBundleURLSchemes: schemes }) =>
    Array.isArray(schemes) ? schemes.includes(scheme) : false,
  );
}
module.exports.hasScheme = hasScheme;

/**
 * @param {import("@expo/config-plugins").InfoPlist} infoPlist
 * @returns {Array<string>}
 */
function getSchemesFromPlist(infoPlist) {
  if (Array.isArray(infoPlist.CFBundleURLTypes)) {
    return infoPlist.CFBundleURLTypes.reduce((schemes, { CFBundleURLSchemes }) => {
      if (Array.isArray(CFBundleURLSchemes)) {
        return [...schemes, ...CFBundleURLSchemes];
      }
      return schemes;
    }, []);
  }
  return [];
}
module.exports.getSchemesFromPlist = getSchemesFromPlist;
