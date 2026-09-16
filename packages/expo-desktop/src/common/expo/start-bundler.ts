import type { ExpoConfig } from "@expo/config";

import { getConfig } from "@expo/config";
import chalk from "chalk";
import { createRequire } from "node:module";
import path from "node:path";

import { env } from "./env.ts";
import { CommandError } from "./error.ts";
import { isInteractive } from "./interactive.ts";
import * as Log from "./log.ts";

const require = createRequire(import.meta.url);

export async function startBundlerAsync(
  projectRoot: string,
  {
    port,
    headless,
    scheme,
    mode,
  }: { port: number; headless?: boolean; scheme?: string; mode: "development" | "production" },
): Promise<DevServerManager> {
  const options: BundlerStartOptions = {
    port,
    headless,
    devClient: true,
    minify: false,
    mode,
    location: {
      hostType: "localhost",
      ...(scheme !== undefined ? { scheme } : {}),
    },
  };

  const {
    DevServerManagerModule: { DevServerManager },
    startInterfaceModule: { startInterfaceAsync },
  } = getExpoCliModules(projectRoot);

  const devServerManager = await DevServerManager.startMetroAsync(projectRoot, options);

  // Present the Terminal UI.
  if (!headless && isInteractive()) {
    // Only read the config if we are going to use the results.
    const { exp } = getConfig(projectRoot, {
      // We don't need very many fields here, just use the lightest possible read.
      skipSDKVersionRequirement: true,
      skipPlugins: true,
    });
    await startInterfaceAsync(devServerManager, {
      platforms: exp.platforms ?? [],
    });
  } else {
    // Display the server location in CI...
    const url = devServerManager.getDefaultDevServer()?.getDevServerUrl();

    if (url) {
      if (env.__EXPO_E2E_TEST) {
        // Print the URL to stdout for tests
        console.info(`[__EXPO_E2E_TEST:server] ${JSON.stringify({ url })}`);
      }
      Log.log(chalk`Waiting on {underline ${url}}`);
    }
  }

  if (!options.headless) {
    await devServerManager.watchEnvironmentVariables();
    await devServerManager.bootstrapTypeScriptAsync();
  }

  return devServerManager;
}

function getExpoCliModules(projectRoot: string) {
  let expoCliPath;
  try {
    expoCliPath = path.dirname(require.resolve("@expo/cli/package.json", { paths: [projectRoot] }));
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    throw new CommandError(
      `Unable to find Expo CLI relative to project root "${projectRoot}". Make sure to have 'expo' as a dependency in your project's package.json, and make sure that you've installed dependencies before running this command.`,
    );
  }

  const DevServerManagerModulePath = path.resolve(
    expoCliPath,
    "build/src/start/server/DevServerManager",
  );
  let DevServerManagerModule: {
    DevServerManager: typeof DevServerManager;
  };
  try {
    DevServerManagerModule = require(DevServerManagerModulePath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    throw new CommandError(
      `Unable to find module at "${DevServerManagerModulePath}". This module should be available from at least Expo SDK 54 to SDK 58; has Expo changed, or do you just need to reinstall dependencies? Please file an issue on Expo Desktop if reinstalling dependencies doesn't help.`,
    );
  }

  const startInterfaceModulePath = path.resolve(
    expoCliPath,
    "build/src/start/interface/startInterface",
  );
  let startInterfaceModule: {
    startInterfaceAsync(
      manager: DevServerManager,
      options: Pick<StartOptions, "devClient" | "platforms" | "mcpServer" | "dependencyCheckRef">,
    ): Promise<void>;
  };
  try {
    startInterfaceModule = require(startInterfaceModulePath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    throw new CommandError(
      `Unable to find module at "${startInterfaceModulePath}". This module should be available from at least Expo SDK 54 to SDK 58; has Expo changed, or do you just need to reinstall dependencies? Please file an issue on Expo Desktop if reinstalling dependencies doesn't help.`,
    );
  }

  return {
    DevServerManagerModule,
    startInterfaceModule,
  };
}

/**
 * Non-exhaustive interface for:
 * packages/@expo/cli/src/start/server/DevServerManager.ts
 */
export declare class DevServerManager {
  static startMetroAsync(
    projectRoot: string,
    startOptions: BundlerStartOptions,
  ): Promise<DevServerManager>;
  bootstrapTypeScriptAsync(): Promise<void>;
  getDefaultDevServer(): BundlerDevServer;
  stopAsync(): Promise<void>;
  watchEnvironmentVariables(): Promise<void>;
}

/**
 * Non-exhaustive interface for:
 * packages/@expo/cli/src/start/server/BundlerDevServer.ts
 */
declare abstract class BundlerDevServer {
  getDevServerUrl(options?: { hostType?: "localhost" }): string | null;
}

interface BundlerStartOptions {
  /** Should the dev server use `https` protocol. */
  https?: undefined | boolean;
  /** Should start the dev servers in development mode (minify). */
  mode?: undefined | "development" | "production";
  /** Is dev client enabled. */
  devClient?: undefined | boolean;
  /** Should run dev servers with clean caches. */
  resetDevServer?: undefined | boolean;
  /** Code signing private key path (defaults to same directory as certificate) */
  privateKeyPath?: undefined | string;

  /** Max amount of workers (threads) to use with Metro bundler, defaults to undefined for max workers. */
  maxWorkers?: undefined | number;
  /** Port to start the dev server on. */
  port?: undefined | number;

  /** Should start a headless dev server e.g. mock representation to approximate info from a server running in a different process. */
  headless?: undefined | boolean;
  /** Should instruct the bundler to create minified bundles. */
  minify?: undefined | boolean;

  /** Will the bundler be used for exporting. NOTE: This is an odd option to pass to the dev server. */
  isExporting?: undefined | boolean;

  // Webpack options
  /** Should modify and create PWA icons. */
  isImageEditingEnabled?: undefined | boolean;

  location: CreateURLOptions;
}

interface CreateURLOptions {
  /** URL scheme to use when opening apps in custom runtimes. */
  scheme?: string | null;
  /** Type of dev server host to use. */
  hostType?: "localhost" | "lan" | "tunnel";
  /** Requested hostname. */
  hostname?: string | null;
  /** Address the client used to reach the dev server, from a forwarded request */
  forwarded?: ForwardedRequestInfo | null;
}

interface ForwardedRequestInfo {
  authority: string | undefined;
  protocol: "http" | "https" | undefined;
  viaForwardedHeader: boolean;
}

type StartOptions = {
  isWebSocketsEnabled?: boolean;
  devClient?: boolean;
  reset?: boolean;
  nonPersistent?: boolean;
  maxWorkers?: number;
  platforms?: ExpoConfig["platforms"];
  mcpServer?: McpServer;
  dependencyCheckRef?: DependencyCheckRef;
};

interface DependencyCheckRef {
  result: DependencyCheckResult | null;
  promise: Promise<DependencyCheckResult | null>;
}

interface DependencyCheckResult {
  expo?: { actualVersion: string; expectedVersionOrRange: string };
  otherCount: number;
}

type McpServer = Omit<McpServerProxy, "close"> & {
  /**
   * Close the server
   */
  closeAsync: () => Promise<void>;
};

/**
 * Simplified general shape of @expo/mcp-tunnel:
 * https://github.com/expo/expo-mcp/blob/6ed9319dd7d33e4350c448ebea5561abdbffbb75/packages/mcp-tunnel/src/types.ts#L32
 */
interface McpServerProxy {
  /**
   * Registers a tool with a config object and callback.
   */
  registerTool(name: string, config: Record<string, unknown>, cb: unknown): void;

  /**
   * Registers a prompt with a config object and callback.
   */
  registerPrompt(name: string, config: Record<string, unknown>, cb: unknown): void;

  /**
   * Registers a resource with a config object and callback.
   * For static resources, use a URI string. For dynamic resources, use a ResourceTemplate.
   */
  registerResource(
    name: string,
    uriOrTemplate: unknown,
    config: unknown,
    readCallback: unknown,
  ): void;

  /**
   * Starts the MCP server proxy.
   */
  start(): Promise<void>;

  /**
   * Closes the MCP server proxy.
   */
  close(): Promise<void>;

  /**
   * Gets the URL of the dev server.
   */
  get devServerUrl(): string;
}
