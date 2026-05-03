/**
 * Based on `@expo/config-plugins` PrivacyInfo.ts (`macos.privacyManifests`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/PrivacyInfo.ts
 */

const fs = require("node:fs");
const path = require("node:path");
const plist = require("@expo/plist");
const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");

/** @typedef {import("xcode").XcodeProject} XcodeProject */

/**
 * @typedef {{
 *   NSPrivacyAccessedAPITypes: Array<{
 *     NSPrivacyAccessedAPIType: string;
 *     NSPrivacyAccessedAPITypeReasons: string[];
 *   }>;
 *   NSPrivacyCollectedDataTypes: Array<{
 *     NSPrivacyCollectedDataType: string;
 *     NSPrivacyCollectedDataTypeLinked: boolean;
 *     NSPrivacyCollectedDataTypeTracking: boolean;
 *     NSPrivacyCollectedDataTypePurposes: string[];
 *   }>;
 *   NSPrivacyTracking: boolean;
 *   NSPrivacyTrackingDomains: string[];
 * }} PrivacyInfo
 */

/**
 * @param {import("@expo/config-types").ExpoConfig} config
 * @returns {import("@expo/config-types").ExpoConfig}
 */
function withPrivacyInfo(config) {
  const privacyManifests = config.macos?.privacyManifests;
  if (!privacyManifests) {
    return config;
  }

  return macosPlugins.withXcodeProject(config, (projectConfig) => {
    return setPrivacyInfo(projectConfig, privacyManifests);
  });
}
Object.defineProperty(withPrivacyInfo, "name", {
  value: "withPrivacyInfo",
});

/**
 * @param {import("@expo/config-plugins").ExportedConfigWithProps & { modResults: XcodeProject; modRequest: { projectRoot: string; platformProjectRoot: string } }} projectConfig
 * @param {Partial<PrivacyInfo>} privacyManifests
 * @returns {import("@expo/config-plugins").ExportedConfigWithProps & { modResults: XcodeProject; modRequest: { projectRoot: string; platformProjectRoot: string } }}
 */
function setPrivacyInfo(projectConfig, privacyManifests) {
  const { projectRoot, platformProjectRoot } = projectConfig.modRequest;

  const projectName = Xcodeproj.getProjectName(projectRoot, "macos");

  const privacyFilePath = path.join(platformProjectRoot, projectName, "PrivacyInfo.xcprivacy");

  const existingFileContent = getFileContents(privacyFilePath);

  const parsedContent = existingFileContent ? plist.parse(existingFileContent) : {};
  const mergedContent = mergePrivacyInfo(
    /** @type {Partial<PrivacyInfo>} */ (parsedContent),
    privacyManifests,
  );
  const contents = plist.build(mergedContent);

  ensureFileExists(privacyFilePath, contents);

  if (!projectConfig.modResults.hasFile(privacyFilePath)) {
    projectConfig.modResults = Xcodeproj.addResourceFileToGroup({
      filepath: path.join(projectName, "PrivacyInfo.xcprivacy"),
      groupName: projectName,
      project: projectConfig.modResults,
      isBuildFile: true,
      verbose: true,
    });
  }

  return projectConfig;
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
function getFileContents(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, { encoding: "utf8" });
}

/**
 * @param {string} filePath
 * @param {string} contents
 */
function ensureFileExists(filePath, contents) {
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  fs.writeFileSync(filePath, contents);
}

/**
 * @param {Partial<PrivacyInfo>} existing
 * @param {Partial<PrivacyInfo>} privacyManifests
 * @returns {PrivacyInfo}
 */
function mergePrivacyInfo(existing, privacyManifests) {
  let {
    NSPrivacyAccessedAPITypes = [],
    NSPrivacyCollectedDataTypes = [],
    NSPrivacyTracking = false,
    NSPrivacyTrackingDomains = [],
  } = structuredClone(existing);
  // tracking is a boolean, so we can just overwrite it
  NSPrivacyTracking = privacyManifests.NSPrivacyTracking ?? existing.NSPrivacyTracking ?? false;
  // merge the api types – for each type ensure the key is in the array, and if it is add the reason if it's not there
  privacyManifests.NSPrivacyAccessedAPITypes?.forEach((newType) => {
    const existingType = NSPrivacyAccessedAPITypes.find(
      (t) => t.NSPrivacyAccessedAPIType === newType.NSPrivacyAccessedAPIType,
    );
    if (!existingType) {
      NSPrivacyAccessedAPITypes.push(newType);
    } else {
      existingType.NSPrivacyAccessedAPITypeReasons = [
        ...new Set(
          existingType?.NSPrivacyAccessedAPITypeReasons?.concat(
            ...newType.NSPrivacyAccessedAPITypeReasons,
          ),
        ),
      ];
    }
  });
  // merge the collected data types – for each type ensure the key is in the array, and if it is add the purposes if it's not there
  privacyManifests.NSPrivacyCollectedDataTypes?.forEach((newType) => {
    const existingType = NSPrivacyCollectedDataTypes.find(
      (t) => t.NSPrivacyCollectedDataType === newType.NSPrivacyCollectedDataType,
    );
    if (!existingType) {
      NSPrivacyCollectedDataTypes.push(newType);
    } else {
      existingType.NSPrivacyCollectedDataTypePurposes = [
        ...new Set(
          existingType?.NSPrivacyCollectedDataTypePurposes?.concat(
            ...newType.NSPrivacyCollectedDataTypePurposes,
          ),
        ),
      ];
    }
  });
  // merge the tracking domains
  NSPrivacyTrackingDomains = [
    ...new Set(NSPrivacyTrackingDomains.concat(privacyManifests.NSPrivacyTrackingDomains ?? [])),
  ];

  return {
    NSPrivacyAccessedAPITypes,
    NSPrivacyCollectedDataTypes,
    NSPrivacyTracking,
    NSPrivacyTrackingDomains,
  };
}

exports.mergePrivacyInfo = mergePrivacyInfo;
exports.setPrivacyInfo = setPrivacyInfo;
exports.withPrivacyInfo = withPrivacyInfo;
