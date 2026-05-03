/**
 * Based on `@expo/config-plugins` Locales.ts (`macos/{projectName}/Supporting`, `getProjectName(_, "macos")`).
 * Locale JSON still merges the nested `ios` key via `getResolvedLocalesAsync(..., "ios")`, matching Expo’s Apple-platform metadata shape.
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/ios/Locales.ts
 */

const fs = require("node:fs");
const path = require("node:path");
const { getResolvedLocalesAsync } = require("@expo/config-plugins/build/utils/locales");
const Xcodeproj = require("./Xcodeproj");
const macosPlugins = require("./macos-plugins");

/** @typedef {import("xcode").XcodeProject} XcodeProject */
/** @typedef {import("@expo/config-plugins/build/utils/locales").LocaleJson} LocaleJson */

const LOCALE_JSON_PLATFORM = "ios";

/**
 * @type {import("@expo/config-plugins").ConfigPlugin}
 */
function withLocales(config) {
  return macosPlugins.withXcodeProject(config, async (config) => {
    config.modResults = await setLocalesAsync(config, {
      projectRoot: config.modRequest.projectRoot,
      project: config.modResults,
    });
    return config;
  });
}
Object.defineProperty(withLocales, "name", {
  value: "withLocales",
});

/**
 * @param {{
 *   localesMap: LocaleJson | import("@expo/config-plugins/build/utils/locales").ResolvedLocalesJson;
 *   supportingDirectory: string;
 *   fileName: string;
 *   projectName: string;
 *   project: XcodeProject;
 * }} opts
 * @returns {Promise<XcodeProject>}
 */
async function writeStringsFile({
  localesMap,
  supportingDirectory,
  fileName,
  projectName,
  project,
}) {
  for (const [lang, localizationObj] of Object.entries(localesMap)) {
    if (Object.entries(localizationObj).length === 0) return project;
    const dir = path.join(supportingDirectory, `${lang}.lproj`);
    await fs.promises.mkdir(dir, { recursive: true });

    const strings = path.join(dir, fileName);
    const buffer = [];
    for (const [plistKey, localVersion] of Object.entries(localizationObj)) {
      buffer.push(`${plistKey} = "${localVersion}";`);
    }
    // Write the file to the file system.
    await fs.promises.writeFile(strings, buffer.join("\n"));

    const groupName = `${projectName}/Supporting/${lang}.lproj`;
    // deep find the correct folder
    const group = Xcodeproj.ensureGroupRecursively(project, groupName);

    // Ensure the file doesn't already exist
    if (!group?.children.some(({ comment }) => comment === fileName)) {
      project = Xcodeproj.addResourceFileToGroup({
        filepath: path.relative(supportingDirectory, strings),
        groupName,
        project,
        isBuildFile: true,
        verbose: true,
      });
    }
  }
  return project;
}

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "locales">} config
 * @returns {Record<string, string | LocaleJson> | null}
 */
function getLocales(config) {
  return config.locales ?? null;
}

/**
 * Normalizes older and newer `@expo/config-plugins` `getResolvedLocalesAsync` results.
 *
 * @param {unknown} resolved
 */
function unwrapResolvedLocales(resolved) {
  if (
    resolved &&
    typeof resolved === "object" &&
    "localesMap" in /** @type {object} */ (resolved)
  ) {
    const r = /** @type {{ localesMap?: object; localizableStringsIOS?: object }} */ (resolved);
    return {
      localesMap: r.localesMap ?? {},
      localizableStrings: r.localizableStringsIOS,
    };
  }
  return {
    localesMap: /** @type {Record<string, LocaleJson>} */ (
      resolved && typeof resolved === "object" ? resolved : {}
    ),
    localizableStrings: undefined,
  };
}

/**
 * @param {Pick<import("@expo/config-types").ExpoConfig, "locales">} config
 * @param {{ projectRoot: string; project: XcodeProject }} opts
 * @returns {Promise<XcodeProject>}
 */
async function setLocalesAsync(config, { projectRoot, project: proj }) {
  const locales = getLocales(config);
  if (!locales) {
    return proj;
  }
  const resolved = await getResolvedLocalesAsync(projectRoot, locales, LOCALE_JSON_PLATFORM);
  const { localesMap, localizableStrings } = unwrapResolvedLocales(resolved);

  const projectName = Xcodeproj.getProjectName(projectRoot, "macos");
  const supportingDirectory = path.join(projectRoot, "macos", projectName, "Supporting");

  // TODO: Should we delete all before running? Revisit after we land on a lock file.
  proj = await writeStringsFile({
    localesMap,
    supportingDirectory,
    fileName: "InfoPlist.strings",
    projectName,
    project: proj,
  });
  if (localizableStrings && Object.keys(localizableStrings).length) {
    proj = await writeStringsFile({
      localesMap: localizableStrings,
      supportingDirectory,
      fileName: "Localizable.strings",
      projectName,
      project: proj,
    });
  }
  return proj;
}

exports.getLocales = getLocales;
exports.setLocalesAsync = setLocalesAsync;
exports.withLocales = withLocales;
exports.writeStringsFile = writeStringsFile;
