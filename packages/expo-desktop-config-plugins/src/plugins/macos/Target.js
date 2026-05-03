/**
 * Based on `@expo/config-plugins` Target.ts (`getPbxproj` / Xcodeproj helpers routed for `platform`).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/Target.ts
 */

const string = require("@expo/config-plugins/build/ios/utils/string");
const Xcodeproj = require("./Xcodeproj");

/** @typedef {import("xcode").PBXNativeTarget} PBXNativeTarget */
/** @typedef {import("xcode").PBXTargetDependency} PBXTargetDependency */
/** @typedef {import("xcode").XCBuildConfiguration} XCBuildConfiguration */
/** @typedef {import("xcode").XcodeProject} XcodeProject */

/** @typedef {[string, import("xcode").PBXNativeTarget]} NativeTargetSectionEntry */

/** @readonly */
const TargetType = Object.freeze({
  APPLICATION: "com.apple.product-type.application",
  EXTENSION: "com.apple.product-type.app-extension",
  WATCH: "com.apple.product-type.application.watchapp",
  APP_CLIP: "com.apple.product-type.application.on-demand-install-capable",
  STICKER_PACK_EXTENSION: "com.apple.product-type.app-extension.messages-sticker-pack",
  FRAMEWORK: "com.apple.product-type.framework",
  OTHER: "other",
});

/**
 * @typedef {{
 *   name: string;
 *   type: string;
 *   signable: boolean;
 *   dependencies?: NativeTargetDependencyTree[];
 * }} NativeTargetDependencyTree
 */

/**
 * @param {XcodeProject} project
 * @param {{ targetName?: string; buildConfiguration?: string }} [options]
 * @returns {XCBuildConfiguration | null}
 */
function getXCBuildConfigurationFromPbxproj(
  project,
  { targetName, buildConfiguration = "Release" } = {},
) {
  const [, nativeTarget] = targetName
    ? findNativeTargetByName(project, targetName)
    : findFirstNativeTarget(project);
  const [, xcBuildConfiguration] = Xcodeproj.getBuildConfigurationForListIdAndName(project, {
    configurationListId: nativeTarget.buildConfigurationList,
    buildConfiguration,
  });
  return xcBuildConfiguration ?? null;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @param {string} scheme
 * @returns {Promise<NativeTargetDependencyTree>}
 */
async function findApplicationTargetWithDependenciesAsync(projectRoot, scheme, platform) {
  const BuildScheme = require("./BuildScheme");
  const applicationTargetName = await BuildScheme.getApplicationTargetNameForSchemeAsync(
    projectRoot,
    platform,
    scheme,
  );
  const project = Xcodeproj.getPbxproj(projectRoot, platform);
  const [, applicationTarget] = findNativeTargetByName(project, applicationTargetName);
  const dependencies = getTargetDependencies(project, applicationTarget);
  return {
    name: string.trimQuotes(applicationTarget.name),
    type: TargetType.APPLICATION,
    signable: true,
    dependencies,
  };
}

/**
 * @param {XcodeProject} project
 * @param {PBXNativeTarget} parentTarget
 * @returns {NativeTargetDependencyTree[] | undefined}
 */
function getTargetDependencies(project, parentTarget) {
  if (!parentTarget.dependencies || parentTarget.dependencies.length === 0) {
    return undefined;
  }

  const nonSignableTargetTypes = [TargetType.FRAMEWORK];

  return parentTarget.dependencies.map(({ value }) => {
    const { target: targetId } = /** @type {PBXTargetDependency} */ (
      project.getPBXGroupByKeyAndType(value, "PBXTargetDependency")
    );

    const [, target] = findNativeTargetById(project, targetId);

    const type = isTargetOfType(target, TargetType.EXTENSION)
      ? TargetType.EXTENSION
      : TargetType.OTHER;
    return {
      name: string.trimQuotes(target.name),
      type,
      signable: !nonSignableTargetTypes.some((signableTargetType) =>
        isTargetOfType(target, signableTargetType),
      ),
      dependencies: getTargetDependencies(project, target),
    };
  });
}

/**
 * @param {PBXNativeTarget} target
 * @param {string} targetType
 * @returns {boolean}
 */
function isTargetOfType(target, targetType) {
  return string.trimQuotes(target.productType) === targetType;
}

/**
 * @param {XcodeProject} project
 * @returns {NativeTargetSectionEntry[]}
 */
function getNativeTargets(project) {
  const section = project.pbxNativeTargetSection();
  return Object.entries(section).filter(Xcodeproj.isNotComment);
}

/**
 * @param {XcodeProject} project
 * @returns {NativeTargetSectionEntry[]}
 */
function findSignableTargets(project) {
  const targets = getNativeTargets(project);

  const signableTargetTypes = [
    TargetType.APPLICATION,
    TargetType.APP_CLIP,
    TargetType.EXTENSION,
    TargetType.WATCH,
    TargetType.STICKER_PACK_EXTENSION,
  ];

  const applicationTargets = targets.filter(([, target]) => {
    for (const targetType of signableTargetTypes) {
      if (isTargetOfType(target, targetType)) {
        return true;
      }
    }
    return false;
  });
  if (applicationTargets.length === 0) {
    throw new Error(`Could not find any signable targets in project.pbxproj`);
  }
  return applicationTargets;
}

/**
 * @param {XcodeProject} project
 * @returns {NativeTargetSectionEntry}
 */
function findFirstNativeTarget(project) {
  const targets = getNativeTargets(project);

  /** @type {Array<[hash: string, import("xcode").PBXNativeTarget]>} */
  const applicationTargets = new Array();
  for (const [hash, target] of targets) {
    if (!isTargetOfType(target, TargetType.APPLICATION)) {
      continue;
    }
    applicationTargets.push([hash, target]);
  }

  if (!applicationTargets.length) {
    throw new Error("Could not find any application target in project.pbxproj");
  }

  if (applicationTargets.length === 1) {
    return applicationTargets[0];
  }

  // The starter template for react-native-macos defines HelloWorld-iOS and
  // HelloWorld-macOS targets.
  const macosTarget = applicationTargets.find(([, { name }]) => /-macOS"?$/.test(name));
  if (!macosTarget) {
    throw new Error(
      `Found multiple targets in the project.pbxproj (${JSON.stringify(applicationTargets.map(({ name }) => name))}), but could not distinguish the macOS one`,
    );
  }

  return macosTarget;
}

/**
 * @param {XcodeProject} project
 * @param {string} targetName
 * @returns {NativeTargetSectionEntry}
 */
function findNativeTargetByName(project, targetName) {
  const nativeTargets = getNativeTargets(project);
  const nativeTargetEntry = nativeTargets.find(([, i]) => string.trimQuotes(i.name) === targetName);
  if (!nativeTargetEntry) {
    throw new Error(`Could not find target '${targetName}' in project.pbxproj`);
  }
  return nativeTargetEntry;
}

/**
 * @param {XcodeProject} project
 * @param {string} targetId
 * @returns {NativeTargetSectionEntry}
 */
function findNativeTargetById(project, targetId) {
  const nativeTargets = getNativeTargets(project);
  const nativeTargetEntry = nativeTargets.find(([key]) => key === targetId);
  if (!nativeTargetEntry) {
    throw new Error(`Could not find target with id '${targetId}' in project.pbxproj`);
  }
  return nativeTargetEntry;
}

exports.TargetType = TargetType;
exports.findApplicationTargetWithDependenciesAsync = findApplicationTargetWithDependenciesAsync;
exports.findFirstNativeTarget = findFirstNativeTarget;
exports.findNativeTargetByName = findNativeTargetByName;
exports.findSignableTargets = findSignableTargets;
exports.getNativeTargets = getNativeTargets;
exports.getXCBuildConfigurationFromPbxproj = getXCBuildConfigurationFromPbxproj;
exports.isTargetOfType = isTargetOfType;
