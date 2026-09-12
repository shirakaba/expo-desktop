import type { AssetData } from "@expo/metro/metro/Assets";
import type { BundleOptions } from "@expo/metro/metro/shared/types";

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { copyAsync, removeAsync } from "../../../common/expo/dir.ts";
import * as Log from "../../../common/expo/log.ts";
import {
  convertEntryPointToRelative,
  isAppleUsingHermes,
  type EagerOptions,
} from "./resolveEagerOptions.ts";

const require = createRequire(import.meta.url);
const { getConfig } = require("@expo/config") as {
  getConfig: typeof import("@expo/config").getConfig;
};

type MetroConfig = {
  projectRoot: string;
  transformer: Record<string, unknown>;
  watchFolders?: string[];
  [key: string]: unknown;
};

type MetroBuildResult = {
  assets?: readonly AssetData[];
  code: string;
  map: string;
};

type MetroServer = {
  build(bundleOptions: BundleOptions, options: { withAssets: true }): Promise<MetroBuildResult>;
  end(): Promise<void>;
};

type MetroServerConstructor = new (config: MetroConfig, options: { watch: false }) => MetroServer;

type MetroModules = {
  default: MetroServerConstructor;
};

type MetroConfigModules = {
  getDefaultConfig(projectRoot: string): MetroConfig;
};

type MetroConfigLoaderModules = {
  mergeConfig(base: MetroConfig, config: unknown): MetroConfig | Promise<MetroConfig>;
  resolveConfig(
    filePath?: string,
    cwd?: string,
  ): Promise<{
    config: unknown;
    isEmpty: boolean;
  }>;
};

type MetroOutputModules = {
  save(
    bundle: MetroBuildResult,
    options: Pick<EagerOptions, "bundleEncoding" | "bundleOutput">,
    log: (...message: string[]) => void,
  ): Promise<void>;
};

export async function exportEmbedInternalAsync(
  projectRoot: string,
  options: EagerOptions,
): Promise<void> {
  await removeAsync(options.bundleOutput);

  // Xcode can otherwise load an old bundle after a failed Apple build. The
  // eager output normally lives in a temporary directory, so this is a no-op
  // there, but retaining it matches export:embed when a destination is given.
  const previousPath = guessCopiedAppleBundlePath(options.bundleOutput);
  if (previousPath && fs.existsSync(previousPath)) {
    await removeAsync(previousPath);
  }

  const server = await createMetroServerAsync(projectRoot, options);
  try {
    const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true });
    const bundle = await server.build(getBundleOptions(projectRoot, exp, options), {
      withAssets: true,
    });

    fs.mkdirSync(path.dirname(options.bundleOutput), { recursive: true, mode: 0o755 });
    await Promise.all([
      getMetroOutput(projectRoot).save(bundle, options, Log.log),
      options.assetsDest
        ? persistMetroAssetsAsync(options.assetsDest, bundle.assets ?? [])
        : Promise.resolve(),
    ]);
  } finally {
    await server.end();
  }
}

async function createMetroServerAsync(
  projectRoot: string,
  options: Pick<EagerOptions, "resetCache">,
): Promise<MetroServer> {
  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  const { getDefaultConfig } = requireFromProject("@expo/metro-config") as MetroConfigModules;
  const { mergeConfig, resolveConfig } = requireFromProject(
    "@expo/metro/metro-config",
  ) as MetroConfigLoaderModules;
  const { default: Server } = requireFromProject("@expo/metro/metro/Server") as MetroModules;

  const defaultConfig = getDefaultConfig(projectRoot);
  const resolvedConfig = await resolveConfig(undefined, projectRoot);
  const mergedConfig = resolvedConfig.isEmpty
    ? defaultConfig
    : await mergeConfig(defaultConfig, resolvedConfig.config);

  const config: MetroConfig = {
    ...mergedConfig,
    maxWorkers: mergedConfig.maxWorkers,
    resetCache: options.resetCache,
    transformer: { ...mergedConfig.transformer },
    watchFolders: mergedConfig.watchFolders?.includes(mergedConfig.projectRoot)
      ? mergedConfig.watchFolders
      : [mergedConfig.projectRoot, ...(mergedConfig.watchFolders ?? [])],
  };

  const { exp } = getConfig(projectRoot, { skipSDKVersionRequirement: true });
  config.transformer.publicPath = `/assets?export_path=${getBaseUrl(exp)}/assets`;

  return new Server(config, { watch: false });
}

function getBundleOptions(
  projectRoot: string,
  exp: ReturnType<typeof getConfig>["exp"],
  options: EagerOptions,
): BundleOptions {
  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  const { default: Server } = requireFromProject("@expo/metro/metro/Server") as MetroModules;
  const isHermes = isAppleUsingHermes(projectRoot, options.platform);
  const defaults = (Server as unknown as { DEFAULT_BUNDLE_OPTIONS: BundleOptions })
    .DEFAULT_BUNDLE_OPTIONS;
  const baseUrl = getBaseUrl(exp);
  const routerRoot = getRouterRoot(projectRoot, exp);

  return {
    ...defaults,
    customResolverOptions: {
      ...defaults.customResolverOptions,
      exporting: true,
    },
    customTransformOptions: {
      ...defaults.customTransformOptions,
      baseUrl: baseUrl || undefined,
      engine: isHermes ? "hermes" : undefined,
      reactCompiler: exp.experiments?.reactCompiler ? "true" : undefined,
      routerRoot,
    },
    dev: options.dev,
    entryFile: toPosixPath(convertEntryPointToRelative(projectRoot, options.entryFile)),
    minify: options.minify,
    platform: options.platform,
    unstable_transformProfile: isHermes ? "hermes-stable" : "default",
  };
}

function getBaseUrl(exp: ReturnType<typeof getConfig>["exp"]): string {
  return exp.experiments?.baseUrl?.trim().replace(/\/+$/, "") ?? "";
}

function getRouterRoot(projectRoot: string, exp: ReturnType<typeof getConfig>["exp"]): string {
  if (exp.extra?.router?.root) {
    return toPosixPath(exp.extra.router.root);
  }
  return fs.existsSync(path.join(projectRoot, "src", "app")) ? "src/app" : "app";
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function getMetroOutput(projectRoot: string): MetroOutputModules {
  const requireFromProject = createRequire(path.join(projectRoot, "package.json"));
  return requireFromProject("@expo/metro/metro/shared/output/bundle") as MetroOutputModules;
}

async function persistMetroAssetsAsync(
  outputDirectory: string,
  assets: readonly AssetData[],
): Promise<void> {
  const batches = new Map<string, string>();

  for (const asset of assets) {
    for (let index = 0; index < asset.scales.length; index++) {
      const scale = asset.scales[index];
      const source = asset.files[index];
      if (scale === undefined || source === undefined) {
        continue;
      }

      batches.set(source, path.join(outputDirectory, getAssetLocalPath(asset, scale)));
    }
  }

  await Promise.all(
    [...batches].map(async ([source, destination]) => {
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      await fs.promises.copyFile(source, destination);
    }),
  );
}

function getAssetLocalPath(asset: AssetData, scale: number): string {
  const suffix = scale === 1 ? "" : `@${scale}x`;
  const fileName = `${asset.name}${suffix}.${asset.type}`;
  const location = stripAssetPrefix(asset.httpServerLocation)
    .replace(/^\/+/, "")
    .replace(/\.\.\//g, "_");
  return path.join(location, fileName);
}

function stripAssetPrefix(value: string): string {
  return value.replace(/\/assets\?export_path=(.*)/, "$1");
}

function guessCopiedAppleBundlePath(bundleOutput: string): string | false {
  if (
    !bundleOutput.match(/\/Xcode\/DerivedData\/.*\/Build\/Products\//) &&
    !bundleOutput.match(/\/CoreSimulator\/Devices\/.*\/data\/Containers\/Bundle\/Application\//)
  ) {
    return false;
  }

  const { sync } = require("glob") as typeof import("glob");
  const bundleName = path.basename(bundleOutput);
  const bundleParent = path.dirname(bundleOutput);
  return (
    sync(`*.app/${bundleName}`, {
      cwd: bundleParent,
      absolute: true,
      dot: true,
    })[0] ?? false
  );
}
