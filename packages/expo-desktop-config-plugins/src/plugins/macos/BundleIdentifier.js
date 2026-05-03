/**
 * Based on `@expo/config-plugins` BundleIdentifier.ts (routed via `Paths`/`macos-plugins` for `platform: "macos"`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/BundleIdentifier.ts
 */

const assert = require("node:assert");
const fs = require("node:fs");
const plist = require("@expo/plist");
const { project } = require("xcode");
const Xcodeproj = require("./Xcodeproj");
const Paths = require("./Paths");
const Target = require("./Target");
const macosPlugins = require("./macos-plugins");
const string = require("@expo/config-plugins/build/ios/utils/string");

/** @typedef {import("xcode").XCBuildConfiguration} XCBuildConfiguration */
/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * @typedef {[string, XCBuildConfiguration & { isa?: string }]} ConfigurationSectionEntry
 */

/**
 * @typedef {import("@expo/config-plugins").InfoPlist} InfoPlist
 */

/**
 * @type {import("@expo/config-plugins").ConfigPlugin<{ bundleIdentifier?: string }>}
 */
function withBundleIdentifier(config, { bundleIdentifier }) {
  return macosPlugins.withXcodeProject(config, async (config) => {
    const bundleId = bundleIdentifier ?? config.macos?.bundleIdentifier;
    // Should never happen.
    assert(
      bundleId,
      "`bundleIdentifier` must be defined in the app config (`macos.bundleIdentifier`) or passed to the plugin `withBundleIdentifier`.",
    );

    config.modResults = updateBundleIdentifierForPbxprojObject(config.modResults, bundleId, false);

    return config;
  });
}
Object.defineProperty(withBundleIdentifier, "name", {
  value: "withBundleIdentifier",
});

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, 'macos'> | import("@expo/config-types").ExpoConfig} expoConfigLike
 * @returns {string | null}
 */
function getBundleIdentifier(expoConfigLike) {
  return expoConfigLike.macos?.bundleIdentifier ?? null;
}

/**
 * In Turtle v1 we set the bundleIdentifier directly on Info.plist rather
 * than in pbxproj
 * @param {import("@expo/config-types").ExpoConfig} config
 * @param {InfoPlist} infoPlist
 * @returns {InfoPlist}
 */
function setBundleIdentifier(config, infoPlist) {
  const bundleIdentifier = getBundleIdentifier(config);

  if (!bundleIdentifier) {
    return infoPlist;
  }

  return {
    ...infoPlist,
    CFBundleIdentifier: bundleIdentifier,
  };
}

/**
 * Gets the bundle identifier defined in the Xcode project found in the project directory.
 *
 * A bundle identifier is stored as a value in XCBuildConfiguration entry.
 * Those entries exist for every pair (build target, build configuration).
 * Unless target name is passed, the first target defined in the pbxproj is used
 * (to keep compatibility with the inaccurate legacy implementation of this function).
 * The build configuration is usually 'Release' or 'Debug'. However, it could be any arbitrary string.
 * Defaults to 'Release'.
 *
 * @param {string} projectRoot Path to project root containing the `{platform}` directory
 * @param {'ios' | 'macos'} platform Native platform folder name (e.g. `macos`)
 * @param {{ targetName?: string; buildConfiguration?: string }} [options]
 * @returns {string | null} bundle identifier of the Xcode project or null if the project is not configured
 */
function getBundleIdentifierFromPbxproj(
  projectRoot,
  platform,
  { targetName, buildConfiguration = "Release" } = {},
) {
  /** @type {string | undefined} */
  let pbxprojPath;
  try {
    pbxprojPath = Paths.getPBXProjectPath(projectRoot, platform);
  } catch {
    return null;
  }
  const proj = project(pbxprojPath);
  proj.parseSync();

  const xcBuildConfiguration = Target.getXCBuildConfigurationFromPbxproj(proj, {
    targetName,
    buildConfiguration,
  });
  if (!xcBuildConfiguration) {
    return null;
  }
  return getProductBundleIdentifierFromBuildConfiguration(xcBuildConfiguration);
}

/**
 * @param {XCBuildConfiguration} xcBuildConfiguration
 * @returns {string | null}
 */
function getProductBundleIdentifierFromBuildConfiguration(xcBuildConfiguration) {
  const bundleIdentifierRaw = xcBuildConfiguration.buildSettings.PRODUCT_BUNDLE_IDENTIFIER;
  if (bundleIdentifierRaw) {
    const bundleIdentifier = string.trimQuotes(bundleIdentifierRaw);
    return Xcodeproj.resolveXcodeBuildSetting(
      bundleIdentifier,
      (setting) => /** @type {string | undefined} */ (xcBuildConfiguration.buildSettings[setting]),
    );
  } else {
    return null;
  }
}

/**
 * Updates the bundle identifier for a given pbxproj
 *
 * @param {string} pbxprojPath Path to pbxproj file
 * @param {string} bundleIdentifier Bundle identifier to set in the pbxproj
 * @param {boolean} [updateProductName=true]  Whether to update PRODUCT_NAME
 */
function updateBundleIdentifierForPbxproj(pbxprojPath, bundleIdentifier, updateProductName = true) {
  const proj = project(pbxprojPath);
  proj.parseSync();
  fs.writeFileSync(
    pbxprojPath,
    updateBundleIdentifierForPbxprojObject(proj, bundleIdentifier, updateProductName).writeSync(),
  );
}

/**
 * Updates the bundle identifier for a given pbxproj
 *
 * @param {XcodeProject} proj pbxproj file
 * @param {string} bundleIdentifier Bundle identifier to set in the pbxproj
 * @param {boolean} [updateProductName=true]  Whether to update PRODUCT_NAME
 */
function updateBundleIdentifierForPbxprojObject(proj, bundleIdentifier, updateProductName = true) {
  const [, nativeTarget] = Target.findFirstNativeTarget(proj);

  Xcodeproj.getBuildConfigurationsForListId(proj, nativeTarget.buildConfigurationList).forEach(
    /** @param {ConfigurationSectionEntry} entry */
    ([, item]) => {
      if (item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER === bundleIdentifier) {
        return;
      }

      item.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${bundleIdentifier}"`;

      if (updateProductName) {
        const productName = bundleIdentifier.split(".").pop();
        if (!productName?.includes("$")) {
          item.buildSettings.PRODUCT_NAME = productName;
        }
      }
    },
  );
  return proj;
}

/**
 * Updates the bundle identifier for pbx projects inside the `{platform}` directory of the given project root
 *
 * @param {string} projectRoot Path to project root containing the `{platform}` directory
 * @param {'ios' | 'macos'} platform Native platform folder name (e.g. `macos`)
 * @param {string} bundleIdentifier Desired bundle identifier
 * @param {boolean} [updateProductName=true]  Whether to update PRODUCT_NAME
 */
function setBundleIdentifierForPbxproj(
  projectRoot,
  platform,
  bundleIdentifier,
  updateProductName = true,
) {
  // Get all pbx projects in the ${projectRoot}/{platform} directory
  /** @type {string[]} */
  let pbxprojPaths = [];
  try {
    pbxprojPaths = Paths.getAllPBXProjectPaths(projectRoot, platform);
  } catch {}

  for (const pbxprojPath of pbxprojPaths) {
    updateBundleIdentifierForPbxproj(pbxprojPath, bundleIdentifier, updateProductName);
  }
}

/**
 * Reset bundle identifier field in Info.plist to use PRODUCT_BUNDLE_IDENTIFIER, as recommended by Apple.
 */

const defaultBundleId = "$(PRODUCT_BUNDLE_IDENTIFIER)";

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform Native platform folder name (e.g. `macos`)
 */
function resetAllPlistBundleIdentifiers(projectRoot, platform) {
  const infoPlistPaths = Paths.getAllInfoPlistPaths(projectRoot, platform);

  for (const plistPath of infoPlistPaths) {
    resetPlistBundleIdentifier(plistPath);
  }
}

/**
 * @param {string} plistPath
 */
function resetPlistBundleIdentifier(plistPath) {
  const rawPlist = fs.readFileSync(plistPath, "utf8");
  const plistObject = /** @type {import("@expo/plist").PlistObject} */ (plist.parse(rawPlist));

  if (plistObject.CFBundleIdentifier) {
    if (plistObject.CFBundleIdentifier === defaultBundleId) return;

    // attempt to match default Info.plist format
    const format = { pretty: true, indent: `\t` };

    const xml = plist.build(
      {
        ...plistObject,
        CFBundleIdentifier: defaultBundleId,
      },
      format,
    );

    if (xml !== rawPlist) {
      fs.writeFileSync(plistPath, xml);
    }
  }
}

exports.getBundleIdentifier = getBundleIdentifier;
exports.getBundleIdentifierFromPbxproj = getBundleIdentifierFromPbxproj;
exports.resetAllPlistBundleIdentifiers = resetAllPlistBundleIdentifiers;
exports.resetPlistBundleIdentifier = resetPlistBundleIdentifier;
exports.setBundleIdentifier = setBundleIdentifier;
exports.setBundleIdentifierForPbxproj = setBundleIdentifierForPbxproj;
exports.updateBundleIdentifierForPbxproj = updateBundleIdentifierForPbxproj;
exports.updateBundleIdentifierForPbxprojObject = updateBundleIdentifierForPbxprojObject;
exports.withBundleIdentifier = withBundleIdentifier;
