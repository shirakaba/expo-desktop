/**
 * Based on `@expo/config-plugins` DevelopmentTeam.ts (`macos.appleTeamId`, `platform`‑aware pbxproj paths).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/DevelopmentTeam.ts
 */

const fs = require("node:fs");
const { project } = require("xcode");
const string = require("@expo/config-plugins/build/ios/utils/string");
const Paths = require("./Paths");
const Target = require("./Target");
const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");

/** @typedef {import("xcode").XCBuildConfiguration} XCBuildConfiguration */
/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * Set the Apple development team ID for all build configurations using every native target (mirrors upstream iteration over all native targets).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ appleTeamId?: string } | void>}
 */
function withDevelopmentTeam(config, { appleTeamId } = {}) {
  return macosPlugins.withXcodeProject(config, (config) => {
    const teamId = appleTeamId ?? getDevelopmentTeam(config);
    if (teamId) {
      config.modResults = updateDevelopmentTeamForPbxproj(config.modResults, teamId);
    }

    return config;
  });
}
Object.defineProperty(withDevelopmentTeam, "name", {
  value: "withDevelopmentTeam",
});

/** Get the Apple development team ID from Expo config, if defined */
/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {string | null}
 */
function getDevelopmentTeam(config) {
  return config.macos?.appleTeamId ?? null;
}

/** Set the Apple development team ID for an XCBuildConfiguration object */
/**
 * @param {XCBuildConfiguration} xcBuildConfiguration
 * @param {string | undefined} developmentTeam
 */
function setDevelopmentTeamForBuildConfiguration(xcBuildConfiguration, developmentTeam) {
  if (developmentTeam) {
    xcBuildConfiguration.buildSettings.DEVELOPMENT_TEAM = string.trimQuotes(developmentTeam);
  } else {
    delete xcBuildConfiguration.buildSettings.DEVELOPMENT_TEAM;
  }
}

/**
 * Update the Apple development team ID for all XCBuildConfiguration entries, in all native targets.
 *
 * A development team is stored as a value in XCBuildConfiguration entry.
 * Those entries exist for every pair (build target, build configuration).
 * Unless target name is passed, the first target defined in the pbxproj is used
 * (to keep compatibility with the inaccurate legacy implementation of this function).
 *
 * @param {XcodeProject} proj
 * @param {string | undefined} appleTeamId
 * @returns {XcodeProject}
 */
function updateDevelopmentTeamForPbxproj(proj, appleTeamId) {
  const nativeTargets = Target.getNativeTargets(proj);

  nativeTargets.forEach(([, nativeTarget]) => {
    Xcodeproj.getBuildConfigurationsForListId(proj, nativeTarget.buildConfigurationList).forEach(
      ([, buildConfig]) => setDevelopmentTeamForBuildConfiguration(buildConfig, appleTeamId),
    );
  });

  return proj;
}

/**
 * Updates the Apple development team ID for pbx projects inside the `{platform}` directory of the given project root
 *
 * @param {string} projectRoot Path to project root containing the `{platform}` directory (e.g. `macos`)
 * @param {'ios' | 'macos'} platform
 * @param {string} [appleTeamId] Desired Apple development team ID
 */
function setDevelopmentTeamForPbxproj(projectRoot, platform, appleTeamId) {
  const pbxprojPaths = Paths.getAllPBXProjectPaths(projectRoot, platform);

  for (const pbxprojPath of pbxprojPaths) {
    let proj = project(pbxprojPath);
    proj.parseSync();
    proj = updateDevelopmentTeamForPbxproj(proj, appleTeamId);
    fs.writeFileSync(pbxprojPath, proj.writeSync());
  }
}

exports.getDevelopmentTeam = getDevelopmentTeam;
exports.setDevelopmentTeamForBuildConfiguration = setDevelopmentTeamForBuildConfiguration;
exports.setDevelopmentTeamForPbxproj = setDevelopmentTeamForPbxproj;
exports.updateDevelopmentTeamForPbxproj = updateDevelopmentTeamForPbxproj;
exports.withDevelopmentTeam = withDevelopmentTeam;
