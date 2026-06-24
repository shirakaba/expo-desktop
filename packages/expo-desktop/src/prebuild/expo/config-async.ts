import type { ExpoConfig, ProjectConfig } from "@expo/config";

import { getConfig } from "@expo/config";
import assert from "node:assert";
import util from "node:util";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { setNodeEnv, loadEnvFiles } from "../../common/node-env.ts";

type Options = {
  type?: string;
  full?: boolean;
  json?: boolean;
};

export function logConfig(config: ExpoConfig | ProjectConfig) {
  const isObjStr = (str: string): boolean => /^\w+: {/g.test(str);
  Log.log(
    util.inspect(config, {
      colors: true,
      compact: false,
      // Sort objects to the end so that smaller values aren't hidden between large objects.
      sorted(a: string, b: string) {
        if (isObjStr(a)) return 1;
        if (isObjStr(b)) return -1;
        return 0;
      },
      showHidden: false,
      depth: null,
    }),
  );
}

export async function configAsync(projectRoot: string, options: Options) {
  const loggingFunctions = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  // Disable logging for this command if the user wants to get JSON output.
  // This will ensure that only the JSON is printed to stdout.
  if (options.json) {
    console.log = function () {};
    console.warn = function () {};
    console.error = function () {};
  }
  setNodeEnv("development");
  loadEnvFiles(projectRoot);

  if (options.type) {
    assert.match(options.type, /^(public|prebuild|introspect)$/);
  }

  let config: ProjectConfig;

  if (options.type === "prebuild") {
    const { getPrebuildConfigAsync } = await import("expo-desktop-prebuild-config");

    config = await getPrebuildConfigAsync(projectRoot, {
      platforms: ["ios", "android", "macos", "windows"],
    });
  } else if (options.type === "introspect") {
    const { getPrebuildConfigAsync } = await import("expo-desktop-prebuild-config");
    const { compileModsAsync } =
      await import("expo-desktop-config-plugins/src/plugins/mod-compiler.js");

    config = await getPrebuildConfigAsync(projectRoot, {
      platforms: ["ios", "android", "macos", "windows"],
    });

    await compileModsAsync(config.exp, {
      projectRoot,
      introspect: true,
      platforms: ["ios", "android", "macos", "windows"],
      assertMissingModProviders: false,
    });
    // @ts-ignore
    delete config.modRequest;
    // @ts-ignore
    delete config.modResults;
  } else if (options.type === "public") {
    config = getConfig(projectRoot, {
      skipSDKVersionRequirement: true,
      isPublicConfig: true,
    });
  } else if (options.type) {
    throw new CommandError(
      `Invalid option: --type ${options.type}. Valid options are: public, prebuild`,
    );
  } else {
    config = getConfig(projectRoot, {
      skipSDKVersionRequirement: true,
    });
  }

  const configOutput = options.full ? config : config.exp;

  if (!options.json) {
    Log.log();
    logConfig(configOutput);
    Log.log();
  } else {
    process.stdout.write(JSON.stringify(configOutput));

    // Re-enable logging functions for testing.
    console.log = loggingFunctions.log;
    console.warn = loggingFunctions.warn;
    console.error = loggingFunctions.error;
  }
}
