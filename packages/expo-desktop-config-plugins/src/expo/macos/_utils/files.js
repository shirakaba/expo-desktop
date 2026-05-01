const fs = require("fs");
const path = require("path");
const { sync: glob } = require("glob");

const defaultIgnoredPaths = ["**/@(Carthage|Pods|vendor|node_modules)/**"];

function createFileResolver({ ignoredPaths = [], addWarning }) {
  return function getFilePath({ projectRoot, globPattern, tag, fileName }) {
    const [filePath, ...duplicatePaths] = glob(globPattern, {
      absolute: true,
      cwd: projectRoot,
      ignore: ignoredPaths.concat(defaultIgnoredPaths),
    });

    if (!filePath) {
      throw new Error(`Could not locate project file: ${globPattern}`);
    }

    if (duplicatePaths.length) {
      warnDuplicateFiles({
        tag,
        fileName,
        projectRoot,
        filePath,
        duplicatePaths,
        addWarning,
      });
    }

    return filePath;
  };
}

function warnDuplicateFiles({ projectRoot, filePath, duplicatePaths, fileName, addWarning, tag }) {
  const relativeFilePath = projectRoot ? path.relative(projectRoot, filePath) : filePath;
  const relativeDuplicatePaths = projectRoot
    ? duplicatePaths.map((v) => path.relative(projectRoot, v))
    : duplicatePaths;
  addWarning(
    `paths-${tag}`,
    `Found multiple ${fileName} file paths, using "${relativeFilePath}". Ignored paths: ${JSON.stringify(
      relativeDuplicatePaths,
    )}`,
  );
}

async function getFileInfo(filePath, languages) {
  const extension = path.extname(filePath);
  const language = languages[extension?.toLowerCase()];

  if (!language) {
    throw new Error(`Unexpected file extension: ${extension}`);
  }

  return {
    path: path.normalize(filePath),
    contents: await fs.promises.readFile(filePath, "utf8"),
    language,
  };
}

function writeFile(filePath, contents) {
  return fs.promises.writeFile(filePath, contents, "utf8");
}

module.exports = {
  createFileResolver,
  getFileInfo,
  writeFile,
};
