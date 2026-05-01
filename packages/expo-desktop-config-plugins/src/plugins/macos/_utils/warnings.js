// https://github.com/expo/expo/blob/sdk-52/packages/%40expo/config-plugins/src/utils/warnings.ts

const chalk = require("chalk");

function addWarningAndroid(property, text, link) {
  console.warn(formatWarning("android", property, text, link));
}

function addWarningIOS(property, text, link) {
  console.warn(formatWarning("ios", property, text, link));
}

function addWarningMacOS(property, text, link) {
  addWarningForPlatform("macos", property, text, link);
}

function addWarningWindows(property, text, link) {
  addWarningForPlatform("windows", property, text, link);
}

function addWarningForPlatform(platform, property, text, link) {
  console.warn(formatWarning(platform, property, text, link));
}

function formatWarning(platform, property, warning, link) {
  return chalk.yellow`${"» " + chalk.bold(platform)}: ${property}: ${warning}${link ? chalk.gray(" " + link) : ""}`;
}

exports.addWarningAndroid = addWarningAndroid;
exports.addWarningForPlatform = addWarningForPlatform;
exports.addWarningIOS = addWarningIOS;
exports.addWarningMacOS = addWarningMacOS;
exports.addWarningWindows = addWarningWindows;
