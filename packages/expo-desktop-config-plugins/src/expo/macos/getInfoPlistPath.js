const Xcodeproj = require("./Xcodeproj");
const Target = require("@expo/config-plugins/build/ios/Target");

/**
 * Find the Info.plist path linked to a specific build configuration.
 *
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getInfoPlistPathFromPbxproj(
  projectRootOrProject,
  platform,
  { targetName, buildConfiguration = "Release" } = {},
) {
  const project = Xcodeproj.resolvePathOrProject(projectRootOrProject, platform);
  if (!project) {
    return null;
  }
  const xcBuildConfiguration = Target.getXCBuildConfigurationFromPbxproj(project, {
    targetName,
    buildConfiguration,
  });
  if (!xcBuildConfiguration) {
    return null;
  }
  // The `INFOPLIST_FILE` is relative to the project folder, ex: app/Info.plist.
  return sanitizeInfoPlistBuildProperty(xcBuildConfiguration.buildSettings.INFOPLIST_FILE);
}
function sanitizeInfoPlistBuildProperty(infoPlist) {
  return infoPlist?.replace(/"/g, "").replace("$(SRCROOT)", "") ?? null;
}

exports.getInfoPlistPathFromPbxproj = getInfoPlistPathFromPbxproj;
