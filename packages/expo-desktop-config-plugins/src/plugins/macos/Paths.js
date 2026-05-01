const fs = require("node:fs");
const path = require("node:path");
const { sync: globSync } = require("glob");
const { withSortedGlobResult } = require("./_utils/glob");
const { UnexpectedError } = require("./_utils/errors");
const { addWarningMacOS } = require("./_utils/warnings");
const Entitlements = require("./Entitlements");

const ignoredPaths = ["**/@(Carthage|Pods|vendor|node_modules)/**"];

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAppDelegateHeaderFilePath(projectRoot, platform) {
  const [using, ...extra] = withSortedGlobResult(
    globSync(`${platform}/*/AppDelegate.h`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  );
  if (!using) {
    throw new UnexpectedError(
      `Could not locate a valid AppDelegate header at root: "${projectRoot}"`,
    );
  }
  if (extra.length) {
    warnMultipleFiles({
      tag: "app-delegate-header",
      fileName: "AppDelegate",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAppDelegateFilePath(projectRoot, platform) {
  const [using, ...extra] = withSortedGlobResult(
    globSync(`${platform}/*/AppDelegate.@(m|mm|swift)`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  );

  if (!using) {
    throw new UnexpectedError(`Could not locate a valid AppDelegate at root: "${projectRoot}"`);
  }

  if (extra.length) {
    warnMultipleFiles({
      tag: "app-delegate",
      fileName: "AppDelegate",
      projectRoot,
      using,
      extra,
    });
  }

  return using;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAppDelegateObjcHeaderFilePath(projectRoot, platform) {
  const [using, ...extra] = withSortedGlobResult(
    globSync(`${platform}/*/AppDelegate.h`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  );
  if (!using) {
    throw new UnexpectedError(`Could not locate a valid AppDelegate.h at root: "${projectRoot}"`);
  }
  if (extra.length) {
    warnMultipleFiles({
      tag: "app-delegate-objc-header",
      fileName: "AppDelegate.h",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

/** @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @returns {string}
 */
function getPodfilePath(projectRoot, platform) {
  const [using, ...extra] = withSortedGlobResult(
    globSync(`${platform}/Podfile`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  );
  if (!using) {
    throw new UnexpectedError(`Could not locate a valid Podfile at root: "${projectRoot}"`);
  }
  if (extra.length) {
    warnMultipleFiles({
      tag: "podfile",
      fileName: "Podfile",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

function getLanguage(filePath) {
  const extension = path.extname(filePath);
  if (!extension && path.basename(filePath) === "Podfile") {
    return "rb";
  }
  switch (extension) {
    case ".mm":
      return "objcpp";
    case ".m":
    case ".h":
      return "objc";
    case ".swift":
      return "swift";
    default:
      throw new UnexpectedError(`Unexpected macOS file extension: ${extension}`);
  }
}

function getFileInfo(filePath) {
  return {
    path: path.normalize(filePath),
    contents: fs.readFileSync(filePath, "utf8"),
    language: getLanguage(filePath),
  };
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAppDelegate(projectRoot, platform) {
  const filePath = getAppDelegateFilePath(projectRoot, platform);
  return getFileInfo(filePath);
}

/**
 *
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getSourceRoot(projectRoot, platform) {
  const appDelegate = getAppDelegate(projectRoot, platform);
  return path.dirname(appDelegate.path);
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function findSchemePaths(projectRoot, platform) {
  return withSortedGlobResult(
    globSync(`${platform}/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  );
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function findSchemeNames(projectRoot, platform) {
  const schemePaths = findSchemePaths(projectRoot, platform);
  return schemePaths.map((schemePath) => path.parse(schemePath).name);
}

/** @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @returns {string}
 */
function getAllXcodeProjectPaths(projectRoot, platform) {
  const platformFolder = platform;
  const pbxprojPaths = withSortedGlobResult(
    globSync(`${platformFolder}/**/*.xcodeproj`, {
      cwd: projectRoot,
      ignore: ignoredPaths,
    })
      // Drop leading `/` from glob results to mimick glob@<9 behavior
      .map((filePath) => filePath.replace(/^\//, ""))
      .filter(
        (project) =>
          !/test|example|sample/i.test(project) || path.dirname(project) === platformFolder,
      ),
  ).sort((a, b) => {
    const isAInPlatformFolder = path.dirname(a) === platformFolder;
    const isBInPlatformFolder = path.dirname(b) === platformFolder;
    // preserve previous sort order
    if (
      (isAInPlatformFolder && isBInPlatformFolder) ||
      (!isAInPlatformFolder && !isBInPlatformFolder)
    ) {
      return 0;
    }
    return isAInPlatformFolder ? -1 : 1;
  });
  if (!pbxprojPaths.length) {
    throw new UnexpectedError(
      `Failed to locate the macos/*.xcodeproj files relative to path "${projectRoot}".`,
    );
  }
  return pbxprojPaths.map((value) => path.join(projectRoot, value));
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getXcodeProjectPath(projectRoot, platform) {
  const [using, ...extra] = getAllXcodeProjectPaths(projectRoot, platform);
  if (extra.length) {
    warnMultipleFiles({
      tag: "xcodeproj",
      fileName: "*.xcodeproj",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAllPBXProjectPaths(projectRoot, platform) {
  const projectPaths = getAllXcodeProjectPaths(projectRoot, platform);
  const paths = projectPaths
    .map((value) => path.join(value, "project.pbxproj"))
    .filter((value) => fs.existsSync(value));
  if (!paths.length) {
    throw new UnexpectedError(
      `Failed to locate the macos/*.xcodeproj/project.pbxproj files relative to path "${projectRoot}".`,
    );
  }
  return paths;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getPBXProjectPath(projectRoot, platform) {
  const [using, ...extra] = getAllPBXProjectPaths(projectRoot, platform);
  if (extra.length) {
    warnMultipleFiles({
      tag: "project-pbxproj",
      fileName: "project.pbxproj",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAllInfoPlistPaths(projectRoot, platform) {
  const paths = withSortedGlobResult(
    globSync(`${platform}/*/Info.plist`, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths,
    }),
  ).sort(
    // longer name means more suffixes, we want the shortest possible one to be first.
    (a, b) => a.length - b.length,
  );
  if (!paths.length) {
    throw new UnexpectedError(
      `Failed to locate Info.plist files relative to path "${projectRoot}".`,
    );
  }
  return paths;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getInfoPlistPath(projectRoot, platform) {
  const [using, ...extra] = getAllInfoPlistPaths(projectRoot, platform);
  if (extra.length) {
    warnMultipleFiles({
      tag: "info-plist",
      fileName: "Info.plist",
      projectRoot,
      using,
      extra,
    });
  }
  return using;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getAllEntitlementsPaths(projectRoot, platform) {
  const paths = globSync(`${platform}/*/*.entitlements`, {
    absolute: true,
    cwd: projectRoot,
    ignore: ignoredPaths,
  });
  return paths;
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 * @deprecated: use Entitlements.getEntitlementsPath instead
 */
function getEntitlementsPath(projectRoot, platform) {
  return Entitlements.getEntitlementsPath(projectRoot, platform);
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getSupportingPath(projectRoot, platform) {
  return path.resolve(
    projectRoot,
    platform,
    path.basename(getSourceRoot(projectRoot)),
    "Supporting",
  );
}

/**
 * @param {string} projectRoot
 * @param {'ios' | 'macos'} platform
 */
function getExpoPlistPath(projectRoot, platform) {
  const supportingPath = getSupportingPath(projectRoot, platform);
  return path.join(supportingPath, "Expo.plist");
}

/** @param {{  tag: string, fileName: string, projectRoot?: string, using: string, extra: string[]}} param0
 */
function warnMultipleFiles({ tag, fileName, projectRoot, using, extra }) {
  const usingPath = projectRoot ? path.relative(projectRoot, using) : using;
  const extraPaths = projectRoot ? extra.map((v) => path.relative(projectRoot, v)) : extra;
  addWarningMacOS(
    `paths-${tag}`,
    `Found multiple ${fileName} file paths, using "${usingPath}". Ignored paths: ${JSON.stringify(
      extraPaths,
    )}`,
  );
}

exports.findSchemeNames = findSchemeNames;
exports.findSchemePaths = findSchemePaths;
exports.getAllEntitlementsPaths = getAllEntitlementsPaths;
exports.getAllInfoPlistPaths = getAllInfoPlistPaths;
exports.getAllPBXProjectPaths = getAllPBXProjectPaths;
exports.getAllXcodeProjectPaths = getAllXcodeProjectPaths;
exports.getAppDelegate = getAppDelegate;
exports.getAppDelegateFilePath = getAppDelegateFilePath;
exports.getAppDelegateHeaderFilePath = getAppDelegateHeaderFilePath;
exports.getAppDelegateObjcHeaderFilePath = getAppDelegateObjcHeaderFilePath;
exports.getEntitlementsPath = getEntitlementsPath;
exports.getExpoPlistPath = getExpoPlistPath;
exports.getFileInfo = getFileInfo;
exports.getInfoPlistPath = getInfoPlistPath;
exports.getPBXProjectPath = getPBXProjectPath;
exports.getPodfilePath = getPodfilePath;
exports.getSourceRoot = getSourceRoot;
exports.getSupportingPath = getSupportingPath;
exports.getXcodeProjectPath = getXcodeProjectPath;
