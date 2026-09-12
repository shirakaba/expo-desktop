// This is based on my port of @expo/fingerprint@0.15.2, originally written in:
// https://github.com/shirakaba/rnmprebuilds/tree/main/build-cache-provider
//
import type { HashSource, NormalizedOptions, Options } from "@expo/fingerprint";

import { getOriginalEnv } from "@expo/env";
import expoSpawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import Debug from "debug";
import assert from "node:assert";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import resolveFrom from "resolve-from";
import semver from "semver";

const debug = Debug(
  "expo-desktop:run:macos:build-cache-provider:extra-options",
) as typeof console.log;

const require = createRequire(import.meta.url);
require("@expo/fingerprint") as typeof import("@expo/fingerprint");
const ExpoResolver = require("@expo/fingerprint/build/ExpoResolver") as {
  resolveExpoAutolinkingCliPath(projectRoot: string): string;
  resolveExpoAutolinkingVersion(projectRoot: string): string | null;
};
const ExpoFingerprintOptions = require("@expo/fingerprint/build/Options") as {
  DEFAULT_SOURCE_SKIPS: 512;
};
const ExpoPackages = require("@expo/fingerprint/build/sourcer/Packages") as {
  getPackageSourceAsync(
    projectRoot: string,
    params: {
      /**
       * The package name.
       *
       * Note that the package should be a direct dependency or devDependency of the project.
       * Otherwise on pnpm isolated mode the resolution will fail.
       */
      packageName: string;
      /**
       * Hashing **package.json** file for the package rather than the entire directory.
       * This is useful when the package contains a lot of files.
       */
      packageJsonOnly: boolean;
    },
  ): Promise<HashSource | null>;
};
const SourceSkips = require("@expo/fingerprint/build/sourcer/SourceSkips") as {
  SourceSkips: {
    None: 0;
    ExpoConfigVersions: 1;
    ExpoConfigRuntimeVersionIfString: 2;
    ExpoConfigNames: 4;
    ExpoConfigAndroidPackage: 8;
    ExpoConfigIosBundleIdentifier: 16;
    ExpoConfigSchemes: 32;
    ExpoConfigEASProject: 64;
    ExpoConfigAssets: 128;
    ExpoConfigAll: 256;
    PackageJsonAndroidAndIosScriptsIfNotContainRun: 512;
    PackageJsonScriptsAll: 1024;
    GitIgnore: 2048;
    ExpoConfigExtraSection: 4096;
  };
};
const ExpoFingerprintUtils = require("@expo/fingerprint/build/sourcer/Utils") as {
  getFileBasedHashSourceAsync(
    projectRoot: string,
    filePath: string,
    reason: string,
  ): Promise<HashSource | null>;
  maybeGetRealPathAsync(filePath: string): Promise<string>;
};
const ExpoPath = require("@expo/fingerprint/build/utils/Path") as {
  toPosixPath(filePath: string): string;
};

export async function getExtraOptionsForMacos(
  projectRoot: string,
  options: Options,
): Promise<Options> {
  const expoAutolinkingVersion = ExpoResolver.resolveExpoAutolinkingVersion(projectRoot) ?? "0.0.0";
  const resolvedOptions: Options = {
    // @ts-expect-error Expo is only expecting "android" | "ios".
    platforms: ["macos"],
    // Based on some of DEFAULT_IGNORE_PATHS
    // node_modules/@expo/fingerprint/build/Options.js
    ignorePaths: [
      "**/macos/Pods/**/*",
      "**/macos/build/**/*",
      "**/macos/.xcode.env.local",
      "**/macos/**/project.xcworkspace",
      "**/macos/*.xcworkspace/xcuserdata/**/*",
    ],

    // expo-modules-autolinking supports the `react-native-config` core
    // autolinking from 1.11.2.
    // Match @expo/fingerprint's 1.12.0 default while still allowing an explicit
    // override.
    useRNCoreAutolinkingFromExpo: semver.gte(expoAutolinkingVersion, "1.12.0"),

    ...options,
  };

  const sourcerOptions: Pick<NormalizedOptions, "platforms" | "sourceSkips"> = {
    platforms:
      // @ts-expect-error Expo is only expecting "android" | "ios".
      resolvedOptions.platforms?.filter((platform) => platform === "macos") ?? [],
    sourceSkips: resolvedOptions.sourceSkips ?? ExpoFingerprintOptions.DEFAULT_SOURCE_SKIPS,
  };
  const configuredPlatforms = (resolvedOptions.platforms ?? []) as Array<string>;
  const applePlatforms = configuredPlatforms.filter(
    (platform) => platform === "ios" || platform === "macos",
  ) as Array<"ios" | "macos">;

  const [
    expoAutolinkingAppleSources,
    packageJsonScriptSourcesAsync,
    bareMacosSources,
    coreAutolinkingSourcesFromExpoMacos,
    defaultPackageSourcesAsync,
  ] = await Promise.all([
    getExpoAutolinkingAppleSourcesAsync(
      projectRoot,
      { platforms: applePlatforms },
      expoAutolinkingVersion,
    ),
    getPackageJsonScriptSourcesAsync(projectRoot, sourcerOptions),
    getBareMacosSourcesAsync(projectRoot, sourcerOptions),
    getCoreAutolinkingSourcesFromExpoMacos(
      projectRoot,
      sourcerOptions,
      resolvedOptions.useRNCoreAutolinkingFromExpo,
    ),
    getDefaultPackageSourcesAsync(projectRoot),
  ]);

  return {
    ...resolvedOptions,
    extraSources: [
      ...expoAutolinkingAppleSources,
      ...packageJsonScriptSourcesAsync,
      ...bareMacosSources,
      ...coreAutolinkingSourcesFromExpoMacos,
      ...defaultPackageSourcesAsync,
    ],
  };
}
exports.getExtraOptionsForMacos = getExtraOptionsForMacos;

async function getExpoAutolinkingAppleSourcesAsync(
  projectRoot: string,
  options: { platforms: Array<"ios" | "macos" | "tvos"> },
  expoAutolinkingVersion: string,
): Promise<Array<HashSource>> {
  if (
    !options.platforms.some(
      (platform) => platform === "ios" || platform === "macos" || platform === "tvos",
    )
  ) {
    return [];
  }

  try {
    // `expo-modules-autolinking resolve`:
    // - ≥ 1.10.1: use "apple" or "macos" for macOS; "apple" or "ios" for iOS;
    //             and "apple" or "tvos" for tvOS:
    //             https://github.com/expo/expo/pull/26398
    // - = 1.10.0: use "macos" for macOS; "ios" for iOS; and "tvos" for tvOS:
    //             https://github.com/expo/expo/pull/26287
    // - < 1.10.0: use "ios" for macOS, iOS, and tvOS
    const platform = semver.gte(expoAutolinkingVersion, "1.10.1")
      ? "apple"
      : semver.eq(expoAutolinkingVersion, "1.10.0")
        ? "macos"
        : "ios";
    const reasons = ["expoAutolinkingApple"];
    const results = [];
    const realProjectRoot = await ExpoFingerprintUtils.maybeGetRealPathAsync(projectRoot);
    const { stdout } = await expoSpawnAsync(
      "node",
      [
        ExpoResolver.resolveExpoAutolinkingCliPath(projectRoot),
        "resolve",
        "-p",
        platform,
        "--json",
      ],
      { cwd: projectRoot, env: getOriginalEnv() },
    );
    const config = JSON.parse(stdout);
    for (const module of config.modules) {
      for (const pod of module.pods) {
        const filePath = ExpoPath.toPosixPath(path.relative(realProjectRoot, pod.podspecDir));
        pod.podspecDir = filePath; // use relative path for the dir
        debug(`Adding expo-modules-autolinking Apple dir - ${chalk.dim(filePath)}`);
        results.push({ type: "dir", filePath, reasons });
      }
    }
    results.push({
      type: "contents",
      id: "expoAutolinkingConfig:apple",
      contents: JSON.stringify(config),
      reasons,
    });
    // @ts-ignore
    return results;
  } catch {
    return [];
  }
}

async function getPackageJsonScriptSourcesAsync(
  projectRoot: string,
  options: Pick<NormalizedOptions, "sourceSkips">,
): Promise<Array<HashSource>> {
  if (options.sourceSkips & SourceSkips.SourceSkips.PackageJsonScriptsAll) {
    return [];
  }
  let packageJson: { scripts?: Record<string, string> };
  try {
    packageJson = require(resolveFrom(path.resolve(projectRoot), "./package.json"));
  } catch (e) {
    debug(`Unable to read package.json from ${path.resolve(projectRoot)}/package.json: ` + e);
    return [];
  }

  const results = new Array<HashSource>();
  if (packageJson.scripts) {
    debug(`Adding package.json contents - ${chalk.dim("scripts")}`);
    const id = "packageJson:scripts";
    results.push({
      type: "contents",
      id,
      contents: normalizePackageJsonScriptSources(packageJson.scripts, options),
      reasons: [id],
    });
  }
  return results;
}

function normalizePackageJsonScriptSources(
  scripts: Record<string, string>,
  options: Pick<NormalizedOptions, "sourceSkips">,
) {
  if (
    options.sourceSkips & SourceSkips.SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun
  ) {
    // Replicate the behavior of `expo prebuild`
    if (!scripts.android?.includes("run") || scripts.android === "expo run:android") {
      delete scripts.android;
    }
    if (!scripts.ios?.includes("run") || scripts.ios === "expo run:ios") {
      delete scripts.ios;
    }
    if (!scripts.macos?.includes("run") || scripts.macos === "expo run:macos") {
      delete scripts.macos;
    }
  }
  return JSON.stringify(scripts);
}

async function getBareMacosSourcesAsync(
  projectRoot: string,
  options: Pick<NormalizedOptions, "platforms">,
): Promise<Array<HashSource>> {
  // @ts-expect-error Expo is only expecting "android" | "ios"
  if (options.platforms.includes("macos")) {
    const result = await ExpoFingerprintUtils.getFileBasedHashSourceAsync(
      projectRoot,
      "macos",
      "bareNativeDir",
    );

    if (result != null) {
      debug(`Adding bare native dir - ${chalk.dim("macos")}`);
      return [result];
    }
  }
  return [];
}

async function getCoreAutolinkingSourcesFromExpoMacos(
  projectRoot: string,
  options: Pick<NormalizedOptions, "platforms">,
  useRNCoreAutolinkingFromExpo?: boolean,
): Promise<Array<HashSource>> {
  if (
    useRNCoreAutolinkingFromExpo === false ||
    !options.platforms.some(
      // @ts-expect-error Expo is only expecting "android" | "ios".
      (platform) => platform === "ios" || platform === "macos" || platform === "tvos",
    )
  ) {
    return [];
  }
  try {
    const { stdout } = await expoSpawnAsync(
      "node",
      [
        ExpoResolver.resolveExpoAutolinkingCliPath(projectRoot),
        "react-native-config",
        "--json",
        "--platform",
        // `expo-modules-autolinking react-native-config`:
        // - ≥ 55.0.25: both "macos" and "ios" flags are recognised, but the
        //              "macos" flag seems to be useless for the purpose of
        //              autolinking, as (per testing on v57.0.13) it does not
        //              pick up podspecs under the "ios" folder that specify
        //              "osx" in their "platforms".
        //
        //              So actually, I think your best hope is to use "ios" in
        //              all cases..? There is actually precedent for this, as
        //              the react-native-macos starter template has always used
        //              `react-native-config --json --platform ios`.
        //              https://github.com/expo/expo/pull/46344
        // - < 55.0.25: only the "ios" flag is recognised.
        "ios",
      ],
      { cwd: projectRoot, env: getOriginalEnv() },
    );
    const config = JSON.parse(stdout);
    const results = await parseCoreAutolinkingSourcesAsync({
      config,
      contentsId: "rncoreAutolinkingConfig:macos",
      reasons: ["rncoreAutolinkingMacos"],
      platform: "macos",
    });
    return results;
  } catch (e) {
    debug(chalk.red(`Error adding react-native core autolinking sources for macos.\n${e}`));
    return [];
  }
}

async function parseCoreAutolinkingSourcesAsync({
  config,
  reasons,
  contentsId,
  platform,
}: {
  config: any;
  reasons: Array<string>;
  contentsId: string;
  platform?: string;
}): Promise<Array<HashSource>> {
  const logTag = platform
    ? `react-native core autolinking dir for ${platform}`
    : "react-native core autolinking dir";
  const results = [];
  const root = await ExpoFingerprintUtils.maybeGetRealPathAsync(config.root);
  const autolinkingConfig = {};
  for (const [depName, depData] of Object.entries(config.dependencies)) {
    try {
      stripRncoreAutolinkingAbsolutePaths(depData, root);
      const filePath = ExpoPath.toPosixPath((depData as { root: string }).root);
      debug(`Adding ${logTag} - ${chalk.dim(filePath)}`);
      results.push({ type: "dir", filePath, reasons });
      // @ts-ignore
      autolinkingConfig[depName] = depData;
    } catch (e) {
      debug(chalk.red(`Error adding ${logTag} - ${depName}.\n${e}`));
    }
  }
  results.push({
    type: "contents",
    id: contentsId,
    contents: JSON.stringify(autolinkingConfig),
    reasons,
  });

  // @ts-ignore
  return results;
}

function stripRncoreAutolinkingAbsolutePaths(dependency: any, root: string) {
  assert(dependency.root);
  const dependencyRoot = dependency.root;
  const cmakeDepRoot =
    process.platform === "win32" ? dependencyRoot.replace(/\\/g, "/") : dependencyRoot;
  dependency.root = ExpoPath.toPosixPath(path.relative(root, dependencyRoot));
  for (const platformData of Object.values(
    dependency.platforms as Record<string, Record<string, string>>,
  )) {
    for (const [key, value] of Object.entries(platformData ?? {})) {
      let newValue;
      if (
        process.platform === "win32" &&
        ["cmakeListsPath", "cxxModuleCMakeListsPath"].includes(key)
      ) {
        // CMake paths on Windows are serving in slashes,
        // we have to check startsWith with the same slashes.
        newValue = value?.startsWith?.(cmakeDepRoot)
          ? ExpoPath.toPosixPath(path.relative(root, value))
          : value;
      } else {
        newValue = value?.startsWith?.(dependencyRoot)
          ? ExpoPath.toPosixPath(path.relative(root, value))
          : value;
      }
      platformData[key] = newValue;
    }
  }
}

async function getDefaultPackageSourcesAsync(projectRoot: string): Promise<Array<HashSource>> {
  const results = await Promise.all(
    [
      {
        packageName: "react-native-macos",
        packageJsonOnly: true,
      },
    ].map((params) => ExpoPackages.getPackageSourceAsync(projectRoot, params)),
  );

  // @ts-ignore
  return results.filter(Boolean);
}
