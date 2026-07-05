const fsPromises = require("node:fs/promises");
const {
  BaseMods: { withGeneratedBaseMods, provider },
} = require("@expo/config-plugins");
const { default: XMLBuilder } = require("fast-xml-builder");
const { XMLParser } = require("fast-xml-parser");
const Paths = require("./Paths");

/** @type {import("fast-xml-parser").X2jOptions} */
const losslessXmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  cdataPropName: "__cdata",
  commentPropName: "#comment",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  preserveOrder: true,
};

/** @type {Parameters<import("fast-xml-builder")>["0"] & { entities?: Array<{ regex: RegExp, val: string }>}} */
const losslessXmlBuilderOptions = {
  ignoreAttributes: losslessXmlParserOptions.ignoreAttributes,
  attributeNamePrefix: losslessXmlParserOptions.attributeNamePrefix,
  textNodeName: losslessXmlParserOptions.textNodeName,
  cdataPropName: losslessXmlParserOptions.cdataPropName,
  commentPropName: losslessXmlParserOptions.commentPropName,
  preserveOrder: losslessXmlParserOptions.preserveOrder,
  format: false,
  suppressEmptyNode: false,
};

/**
 * @type {Partial<Record<string, import("@expo/config-plugins/build/plugins/createBaseMod").BaseModProviderMethods<any, any>>>}
 */
const defaultProviders = {
  dangerous: provider({
    getFilePath() {
      return "";
    },
    async read() {
      return {};
    },
    async write() {},
  }),
  finalized: provider({
    getFilePath() {
      return "";
    },
    async read() {
      return {};
    },
    async write() {},
  }),
  appCpp: provider({
    getFilePath({ modRequest: { projectRoot } }) {
      // TODO: work out how to thread filesafeName through modRequest, probably
      //       via evalModsAsync(). For now, we just infer it based on the name
      //       of the .vcxproj file.
      return Paths.getAppCppFilePath({ projectRoot, filesafeName: undefined });
    },
    async read(filePath) {
      return Paths.getFileInfo(filePath);
    },
    async write(filePath, { modResults: { contents } }) {
      await fsPromises.writeFile(filePath, contents);
    },
  }),
  vcxproj: provider({
    isIntrospective: true,
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getVcxprojFilePath({ projectRoot, filesafeName: undefined });
    },
    async read(filePath) {
      const data = await fsPromises.readFile(filePath, "utf-8");
      return new XMLParser(losslessXmlParserOptions).parse(data);
    },
    async write(filePath, { modRequest: { introspect }, modResults }) {
      const builder = new XMLBuilder(losslessXmlBuilderOptions);
      let output = builder.build(modResults);
      // XMLBuilder writes out `&pos;` even if we special-case it in
      // `options.entities`, so I'm resorting to this crude replace as the
      // lesser evil.
      output = output.replaceAll("&apos;", "'");

      // Return early without writing, in introspection mode.
      if (introspect) {
        return;
      }
      await fsPromises.writeFile(filePath, output);
    },
  }),
  wapproj: provider({
    isIntrospective: true,
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getWapprojFilePath({ projectRoot, filesafeName: undefined });
    },
    async read(filePath) {
      const data = await fsPromises.readFile(filePath, "utf-8");
      return new XMLParser(losslessXmlParserOptions).parse(data);
    },
    async write(filePath, { modRequest: { introspect }, modResults }) {
      const builder = new XMLBuilder(losslessXmlBuilderOptions);
      let output = builder.build(modResults);
      // XMLBuilder writes out `&pos;` even if we special-case it in
      // `options.entities`, so I'm resorting to this crude replace as the
      // lesser evil.
      output = output.replaceAll("&apos;", "'");

      // Return early without writing, in introspection mode.
      if (introspect) {
        return;
      }
      await fsPromises.writeFile(filePath, output);
    },
  }),
  appxmanifest: provider({
    isIntrospective: true,
    getFilePath({ modRequest: { projectRoot } }) {
      return Paths.getAppxManifestFilePath({ projectRoot, filesafeName: undefined });
    },
    async read(filePath) {
      const data = await fsPromises.readFile(filePath, "utf-8");
      return new XMLParser(losslessXmlParserOptions).parse(data);
    },
    async write(filePath, { modRequest: { introspect }, modResults }) {
      const builder = new XMLBuilder(losslessXmlBuilderOptions);
      let output = builder.build(modResults);
      // XMLBuilder writes out `&pos;` even if we special-case it in
      // `options.entities`, so I'm resorting to this crude replace as the
      // lesser evil.
      output = output.replaceAll("&apos;", "'");

      // Return early without writing, in introspection mode.
      if (introspect) {
        return;
      }
      await fsPromises.writeFile(filePath, output);
    },
  }),
};

/**
 * @param {import("@expo/config-plugins").ExportedConfig} config
 * @param {import("@expo/config-plugins/build/plugins/createBaseMod").ForwardedBaseModOptions & { providers?: Partial<typeof defaultProviders> }} [props={}]
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withWindowsBaseMods(config, { providers, ...props } = {}) {
  return withGeneratedBaseMods(config, {
    ...props,
    platform: "windows",
    providers: providers ?? getWindowsModFileProviders(),
  });
}

function getWindowsModFileProviders() {
  return defaultProviders;
}

exports.withWindowsBaseMods = withWindowsBaseMods;
exports.getWindowsModFileProviders = getWindowsModFileProviders;
