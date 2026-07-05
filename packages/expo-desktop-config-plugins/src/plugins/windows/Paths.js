const fs = require("node:fs");
const path = require("node:path");
const { sync: globSync } = require("glob");
const { withSortedGlobResult } = require("../macos/_utils/glob");
const { UnexpectedError } = require("../macos/_utils/errors");
const { addWarningWindows } = require("../macos/_utils/warnings");

const ignoredPaths = ["**/node_modules/**"];

/**
 * Gets the path to MyApp.cpp (where "MyApp" may vary based on filesafeName).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | undefined} params.filesafeName - An explicit filesafe name,
 * otherwise will try to infer it based on the name of the vcxproj.
 */
function getAppCppFilePath({ projectRoot, filesafeName }) {
  const [using, ...extra] = globWithInferredFilesafeName({
    extension: ".cpp",
    filesafeName,
    projectRoot,
  });
  if (!using) {
    throw new UnexpectedError(`Could not locate a valid MyApp.cpp at root: "${projectRoot}"`);
  }

  if (extra.length) {
    warnMultipleFiles({
      tag: "app-cpp",
      fileName: "MyApp.cpp",
      projectRoot,
      using,
      extra,
    });
  }

  return using;
}

/**
 * Gets the path to MyApp.vcxproj (where "MyApp" may vary based on
 * filesafeName).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | undefined} params.filesafeName - An explicit filesafe name,
 * otherwise will try to infer it based on the name of the vcxproj.
 */
function getVcxprojFilePath({ projectRoot, filesafeName }) {
  const [using, ...extra] = globWithInferredFilesafeName({
    extension: ".vcxproj",
    filesafeName,
    projectRoot,
  });
  if (!using) {
    throw new UnexpectedError(`Could not locate a valid MyApp.vcxproj at root: "${projectRoot}"`);
  }

  if (extra.length) {
    warnMultipleFiles({
      tag: "app-vcxproj",
      fileName: "MyApp.vcxproj",
      projectRoot,
      using,
      extra,
    });
  }

  return using;
}

/**
 * Gets the path to MyApp.Package.wapproj (where "MyApp" may vary based on
 * filesafeName).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | undefined} params.filesafeName - An explicit filesafe name,
 * otherwise will try to infer it based on the name of the vcxproj.
 */
function getWapprojFilePath({ projectRoot, filesafeName }) {
  const [using, ...extra] = globWithInferredFilesafeName({
    extension: ".Package.wapproj",
    filesafeName,
    projectRoot,
  });
  if (!using) {
    throw new UnexpectedError(
      `Could not locate a valid MyApp.Package.wapproj at root: "${projectRoot}"`,
    );
  }

  if (extra.length) {
    warnMultipleFiles({
      tag: "app-wapproj",
      fileName: "MyApp.Package.wapproj",
      projectRoot,
      using,
      extra,
    });
  }

  return using;
}

/**
 * Gets the path to MyApp.Package/Package.appxmanifest (where "MyApp" may vary
 * based on filesafeName).
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | undefined} params.filesafeName - An explicit filesafe name,
 * otherwise will try to infer it based on the name of the vcxproj.
 */
function getAppxManifestFilePath({ projectRoot, filesafeName }) {
  // TODO: Take filesafeName as a mandatory parameter via app.json or config
  //       plugin arg, rather than accessing the file system to deduce it.
  const fileSafeNameResolved =
    filesafeName ??
    path.basename(getVcxprojFilePath({ projectRoot, filesafeName: undefined }), ".vcxproj");

  return path.resolve(
    projectRoot,
    "windows",
    `${fileSafeNameResolved}.Package`,
    "Package.appxmanifest",
  );
}

/**
 * Globs for a file `${filesafeName}${extension}`, e.g. "MyApp.cpp". Accepts
 * either an explicit filesafe name (e.g. "MyApp"), or `undefined`, in which
 * case it infers the filesafe name from the vcxproj (e.g. "MyApp.vcxproj" ->
 * "MyApp").
 *
 * @throws If no vcxproj files, or more than one vcxproj file, is matched.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string | undefined} params.filesafeName
 * @param {`.${string}`} params.extension
 */
function globWithInferredFilesafeName({ extension, filesafeName, projectRoot }) {
  if (filesafeName) {
    return withSortedGlobResult(
      globSync(`windows/${filesafeName}?(.Package)/${filesafeName}${extension}`, {
        absolute: true,
        cwd: projectRoot,
        ignore: ignoredPaths,
      }),
    );
  }

  const extensionWithoutPeriod = extension.replace(/^\./, "");
  const globPattern =
    extensionWithoutPeriod === "vcxproj"
      ? `windows/*/*.vcxproj`
      : `windows/*/*.@(${extensionWithoutPeriod}|vcxproj)`;
  const matches = globSync(globPattern, {
    absolute: true,
    cwd: projectRoot,
    ignore: ignoredPaths,
  });

  /** @type {Array<string>} */
  const vcxprojFiles = [];
  /** @type {Array<string>} */
  const targetFiles = [];
  for (const match of matches) {
    if (match.endsWith(".vcxproj")) {
      vcxprojFiles.push(match);
    }
    if (match.endsWith(extension)) {
      targetFiles.push(match);
    }
  }

  if (vcxprojFiles.length !== 1) {
    throw new UnexpectedError(
      `Could not find the MyApp${extension} file path, as was unable to find a singular vcxproj to infer its name from (found ${vcxprojFiles.length}). Searched in root: "${projectRoot}"`,
    );
  }
  filesafeName = path.basename(vcxprojFiles[0], ".vcxproj");

  return withSortedGlobResult(
    targetFiles.filter((file) => path.basename(file, extension) === filesafeName),
  );
}

/**
 * @param {string} filePath
 */
function getLanguage(filePath) {
  const extension = path.extname(filePath);

  switch (extension) {
    case ".cpp":
      return "cpp";
    case ".vcxproj":
      return "xml";
    default:
      throw new UnexpectedError(`Unexpected Windows file extension: ${extension}`);
  }
}

/**
 * @param {string} filePath
 */
function getFileInfo(filePath) {
  return {
    path: path.normalize(filePath),
    contents: fs.readFileSync(filePath, "utf8"),
    language: getLanguage(filePath),
  };
}

/** @param {{  tag: string, fileName: string, projectRoot?: string, using: string, extra: string[]}} param0
 */
function warnMultipleFiles({ tag, fileName, projectRoot, using, extra }) {
  const usingPath = projectRoot ? path.relative(projectRoot, using) : using;
  const extraPaths = projectRoot ? extra.map((v) => path.relative(projectRoot, v)) : extra;
  addWarningWindows(
    `paths-${tag}`,
    `Found multiple ${fileName} file paths, using "${usingPath}". Ignored paths: ${JSON.stringify(
      extraPaths,
    )}`,
  );
}

exports.getAppCppFilePath = getAppCppFilePath;
exports.getFileInfo = getFileInfo;
exports.getLanguage = getLanguage;
exports.getVcxprojFilePath = getVcxprojFilePath;
exports.getWapprojFilePath = getWapprojFilePath;
exports.getAppxManifestFilePath = getAppxManifestFilePath;
