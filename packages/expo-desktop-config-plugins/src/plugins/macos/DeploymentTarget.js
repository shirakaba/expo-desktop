/**
 * Based on `@expo/config-plugins` DeploymentTarget.ts (`macos.deploymentTarget`, `MACOSX_DEPLOYMENT_TARGET`, macOS Podfile properties).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/DeploymentTarget.ts
 */

const BuildProperties = require("./BuildProperties");
const Target = require("./Target");
const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");

/** @typedef {import("xcode").XCBuildConfiguration} XCBuildConfiguration */
/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * Set the macOS deployment target for all build configurations in the main application target.
 *
 * @type {import("@expo/config-plugins").ConfigPlugin}
 */
function withDeploymentTarget(config) {
  return macosPlugins.withXcodeProject(config, (config) => {
    const deploymentTarget = getDeploymentTarget(config);
    if (deploymentTarget) {
      config.modResults = updateDeploymentTargetForPbxproj(config.modResults, deploymentTarget);
    }
    return config;
  });
}
Object.defineProperty(withDeploymentTarget, "name", {
  value: "withDeploymentTarget",
});

/**
 * A config-plugin to update `macos/Podfile.properties.json` with the deployment target
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<void>}
 */
const withDeploymentTargetPodfileProps = BuildProperties.createBuildPodfilePropsConfigPlugin(
  [
    {
      propName: "macos.deploymentTarget",
      propValueGetter: (config) => config.macos?.deploymentTarget ?? null,
    },
  ],
  "withDeploymentTargetPodfileProps",
);

/** Get the macOS deployment target from Expo config, if defined */
/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "macos">} config
 * @returns {string | null}
 */
function getDeploymentTarget(config) {
  return config.macos?.deploymentTarget ?? null;
}

/** Set the macOS deployment target for an XCBuildConfiguration object */
/**
 * @param {XCBuildConfiguration} xcBuildConfiguration
 * @param {string | undefined} deploymentTarget
 */
function setDeploymentTargetForBuildConfiguration(xcBuildConfiguration, deploymentTarget) {
  if (deploymentTarget) {
    xcBuildConfiguration.buildSettings.MACOSX_DEPLOYMENT_TARGET = deploymentTarget;
  }
}

/**
 * Update the macOS deployment target for all XCBuildConfiguration entries in the main application target.
 *
 * @param {XcodeProject} proj
 * @param {string} deploymentTarget
 * @returns {XcodeProject}
 */
function updateDeploymentTargetForPbxproj(proj, deploymentTarget) {
  const [, mainTarget] = Target.findFirstNativeTarget(proj);

  Xcodeproj.getBuildConfigurationsForListId(proj, mainTarget.buildConfigurationList).forEach(
    ([, buildConfig]) => setDeploymentTargetForBuildConfiguration(buildConfig, deploymentTarget),
  );

  return proj;
}

exports.getDeploymentTarget = getDeploymentTarget;
exports.setDeploymentTargetForBuildConfiguration = setDeploymentTargetForBuildConfiguration;
exports.updateDeploymentTargetForPbxproj = updateDeploymentTargetForPbxproj;
exports.withDeploymentTarget = withDeploymentTarget;
exports.withDeploymentTargetPodfileProps = withDeploymentTargetPodfileProps;
