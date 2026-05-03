/**
 * Based on `@expo/config-plugins` `utils/locales.ts`, extended with `macos` (parity with `ios` merge + Localizable.strings).
 * @see https://github.com/expo/expo/blob/main/packages/@expo/config-plugins/src/utils/locales.ts
 */

const JsonFile = require("@expo/json-file").default;
const path = require("node:path");
const { addWarningForPlatform } = require("./warnings");

/**
 * For Apple-native targets (`ios` / `macos`), `StringsMap` may contain a
 * `'Localizable.strings'?: StringsMap` entry. Values are written into `Localizable.strings`.
 *
 * @typedef {Record<string, string>} StringsMap
 */

/**
 * @typedef {Record<string, string> & {
 *   ios?: StringsMap;
 *   macos?: StringsMap;
 *   android?: StringsMap;
 * }} LocaleJson
 */

/**
 * @typedef {NonNullable<import("@expo/config-types").ExpoConfig["locales"]>} ExpoConfigLocales
 */

/**
 * @typedef {Record<string, LocaleJson>} ResolvedLocalesJson
 */

/** @typedef {import("@expo/json-file").JSONObject} JSONObject */

/**
 * @param {string} projectRoot
 * @param {ExpoConfigLocales} input
 * @param {"ios" | "macos" | "android"} forPlatform
 * @returns {Promise<{ localesMap: ResolvedLocalesJson; localizableStrings?: ResolvedLocalesJson }>}
 */
async function getResolvedLocalesAsync(projectRoot, input, forPlatform) {
  /** @type {ResolvedLocalesJson} */
  const locales = {};
  /** @type {ResolvedLocalesJson} */
  const localizableStrings = {};
  for (const [lang, localeJsonPath] of Object.entries(input)) {
    const locale = await getLocales(projectRoot, localeJsonPath, forPlatform, lang);
    if (locale) {
      const { android, ios, macos, ...rest } = {
        android: {},
        ios: {},
        macos: {},
        ...locale,
      };
      if (forPlatform === "ios") {
        const { localizableStringsEntry, otherEntries } = extractNestedLocalizableStrings({
          branch: ios,
          lang,
          nestedKey: "ios",
          warningPlatform: "ios",
        });
        if (localizableStringsEntry) {
          localizableStrings[lang] = localizableStringsEntry;
        }
        locales[lang] = { ...rest, ...otherEntries };
      } else if (forPlatform === "macos") {
        const { localizableStringsEntry, otherEntries } = extractNestedLocalizableStrings({
          branch: macos,
          lang,
          nestedKey: "macos",
          warningPlatform: "macos",
        });
        if (localizableStringsEntry) {
          localizableStrings[lang] = localizableStringsEntry;
        }
        locales[lang] = { ...rest, ...otherEntries };
      } else {
        locales[lang] = { ...rest, ...android };
      }
    }
  }

  return { localesMap: locales, localizableStrings };
}

/**
 * @param {string} projectRoot
 * @param {string | JSONObject} localeJsonPath
 * @param {"ios" | "macos" | "android"} forPlatform
 * @param {string} lang
 * @returns {Promise<JSONObject | null>}
 */
async function getLocales(projectRoot, localeJsonPath, forPlatform, lang) {
  if (typeof localeJsonPath === "string") {
    try {
      return await JsonFile.readAsync(path.join(projectRoot, localeJsonPath));
    } catch {
      // Add a warning when a json file cannot be parsed.
      addWarningForPlatform(
        forPlatform,
        `locales.${lang}`,
        `Failed to parse JSON of locale file for language: ${lang}`,
        "https://docs.expo.dev/guides/localization/#translating-app-metadata",
      );
      return null;
    }
  }

  // In the off chance that someone defined the locales json in the config, pass it directly to the object.
  // We do this to make the types more elegant.
  return localeJsonPath;
}

/**
 * @param {{
 *   branch: StringsMap;
 *   lang: string;
 *   nestedKey: "ios" | "macos";
 *   warningPlatform: "ios" | "macos";
 * }} opts
 * @returns {{ localizableStringsEntry?: StringsMap; otherEntries: StringsMap }}
 */
function extractNestedLocalizableStrings({ branch, lang, nestedKey, warningPlatform }) {
  const LOCALIZABLE_STR_ENTRY = "Localizable.strings";
  if (!(LOCALIZABLE_STR_ENTRY in branch)) {
    return { localizableStringsEntry: undefined, otherEntries: branch };
  }

  const { [LOCALIZABLE_STR_ENTRY]: localizableStringsEntry, ...otherEntries } = branch;

  if (!localizableStringsEntry) {
    return { localizableStringsEntry: undefined, otherEntries };
  }

  if (!isStringsMap(localizableStringsEntry)) {
    addWarningForPlatform(
      warningPlatform,
      `locales.${lang}.${nestedKey}['${LOCALIZABLE_STR_ENTRY}']`,
      "Expected a JSON object mapping string keys to string values",
      "https://docs.expo.dev/guides/localization/#translating-app-metadata",
    );
    return { localizableStringsEntry: undefined, otherEntries };
  }

  return { localizableStringsEntry, otherEntries };
}

/**
 * @param {unknown} value
 * @returns {value is StringsMap}
 */
function isStringsMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(/** @type {Record<string, unknown>} */ (value)).every(
    (item) => typeof item === "string",
  );
}

exports.getResolvedLocalesAsync = getResolvedLocalesAsync;
