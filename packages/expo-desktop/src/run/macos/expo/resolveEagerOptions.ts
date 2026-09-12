import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { env } from "../../../common/expo/env.ts";

const require = createRequire(import.meta.url);
const { convertEntryPointToRelative, resolveEntryPoint } = require("@expo/config/paths") as {
  convertEntryPointToRelative(projectRoot: string, absolutePath: string): string;
  resolveEntryPoint(projectRoot: string, options: { platform: string }): string;
};
const { default: canonicalize } = require("@expo/metro/metro-core/canonicalize") as {
  default: (key: string, value: unknown) => unknown;
};

export type EagerOptions = {
  assetsDest: string;
  bundleEncoding: "utf8";
  bundleOutput: string;
  dev: boolean;
  eager: true;
  entryFile: string;
  minify: boolean;
  platform: string;
  resetCache: boolean;
  sourcemapUseAbsolutePath: false;
  verbose: boolean;
};

export function resolveEagerOptionsAsync(
  projectRoot: string,
  {
    dev,
    platform,
    resetCache,
    assetsDest,
    bundleOutput,
    minify,
  }: {
    assetsDest?: string | undefined;
    bundleOutput?: string | undefined;
    dev: boolean;
    minify?: boolean;
    platform: string;
    resetCache?: boolean;
  },
): EagerOptions {
  minify ??= !isAppleUsingHermes(projectRoot, platform);

  let destination: string | undefined;

  if (!assetsDest) {
    destination ??= getTemporaryPath();
    assetsDest = path.join(destination, "assets");
  }

  if (!bundleOutput) {
    destination ??= getTemporaryPath();
    // Apple platforms use main.jsbundle. This includes macOS, whose native
    // build script invokes the same export:embed command as iOS.
    bundleOutput = path.join(destination, "main.jsbundle");
  }

  return {
    assetsDest,
    bundleEncoding: "utf8",
    bundleOutput,
    dev,
    eager: true,
    entryFile: resolveEntryPoint(projectRoot, { platform }),
    minify,
    platform,
    resetCache: !!resetCache,
    sourcemapUseAbsolutePath: false,
    verbose: env.EXPO_DEBUG,
  };
}

/** Match the literal Hermes settings used by the React Native Podfile. */
export function isAppleUsingHermes(projectRoot: string, platform: string): boolean {
  const nativeDirectory = platform === "macos" ? "macos" : "ios";
  const podfilePath = path.join(projectRoot, nativeDirectory, "Podfile");

  if (fs.existsSync(podfilePath)) {
    const content = fs.readFileSync(podfilePath, "utf8");
    if (/:hermes_enabled\s*=>\s*false|hermes_enabled\s*:\s*false/.test(content)) {
      return false;
    }
    if (/:hermes_enabled\s*=>\s*true|hermes_enabled\s*:\s*true/.test(content)) {
      return true;
    }

    // A Podfile that delegates to podfile.properties.json follows the default
    // Hermes setting unless that file explicitly selects JSC.
    const propertiesReference = /podfile_properties\[\s*["']expo\.jsEngine["']\s*\]/.test(content);
    if (!propertiesReference) {
      return true;
    }
  }

  const propertiesPath = path.join(projectRoot, nativeDirectory, "Podfile.properties.json");
  if (fs.existsSync(propertiesPath)) {
    try {
      const properties = JSON.parse(fs.readFileSync(propertiesPath, "utf8")) as {
        "expo.jsEngine"?: unknown;
      };
      if (properties["expo.jsEngine"] === "jsc") {
        return false;
      }
      if (properties["expo.jsEngine"] === "hermes") {
        return true;
      }
    } catch {
      // Fall through to the native default when the optional properties file
      // cannot be read.
    }
  }

  // Hermes is the default engine for Expo's Apple templates.
  return true;
}

export { convertEntryPointToRelative };

export function getExportEmbedOptionsKey({
  resetCache,
  assetsDest,
  bundleOutput,
  verbose,
  eager,
  ...options
}: EagerOptions): string {
  return JSON.stringify(options, canonicalize);
}

function getTemporaryPath(): string {
  return path.join(os.tmpdir(), Math.random().toString(36).substring(2));
}
