// Mirrors the minimal parts of withMacosBaseMods needed for mods like
// `mods.windows.dangerous` (used by withDangerousMod-based plugins).

const {
  BaseMods: { withGeneratedBaseMods, provider },
} = require("@expo/config-plugins");

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
