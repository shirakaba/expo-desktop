// https://github.com/expo/expo/blob/sdk-52/packages/%40expo/config-plugins/src/utils/modules.ts

const fs = require("node:fs");

async function statAsync(file) {
  try {
    return await fs.promises.stat(file);
  } catch {
    return null;
  }
}

async function fileExistsAsync(file) {
  return (await statAsync(file))?.isFile() ?? false;
}

async function directoryExistsAsync(file) {
  return (await statAsync(file))?.isDirectory() ?? false;
}

function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

exports.directoryExistsAsync = directoryExistsAsync;
exports.fileExists = fileExists;
exports.fileExistsAsync = fileExistsAsync;
