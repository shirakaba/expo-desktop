import { getConfig } from "@expo/config";
import chalk from "chalk";
import { createRequire } from "node:module";
import path from "node:path";

import { env } from "./env.ts";
import { isInteractive } from "./interactive.ts";
import * as Log from "./log.ts";

const require = createRequire(import.meta.url);

type ExpoDevServer = {
  getDevServerUrl(): string | null;
};

export type DevServerManager = {
  stopAsync(): Promise<void>;
};

type ManagedDevServerManager = DevServerManager & {
  getDefaultDevServer(): ExpoDevServer | undefined;
  watchEnvironmentVariables(): Promise<void>;
  bootstrapTypeScriptAsync(): Promise<void>;
};

type ExpoCliModules = {
  DevServerManager: {
    startMetroAsync(
      projectRoot: string,
      options: {
        port: number;
        headless: boolean | undefined;
        devClient: boolean;
        minify: boolean;
        mode: "development" | "production";
        location: {
          hostType: "localhost";
          scheme?: string;
        };
      },
    ): Promise<ManagedDevServerManager>;
  };
  startInterfaceAsync(
    manager: ManagedDevServerManager,
    options: { platforms: string[] },
  ): Promise<void>;
};

export async function startBundlerAsync(
  projectRoot: string,
  {
    port,
    headless,
    scheme,
    mode,
  }: { port: number; headless?: boolean; scheme?: string; mode: "development" | "production" },
): Promise<DevServerManager> {
  const options = {
    port,
    headless,
    devClient: true,
    minify: false,
    // The Expo CLI run implementation defaults to development mode. The
    // desktop runner also passes production mode for `run macos` release
    // builds so the server matches the native configuration.
    mode,
    location: {
      // Desktop apps run on the host, so localhost is the address embedded in
      // their development client configuration.
      hostType: "localhost" as const,
      ...(scheme !== undefined ? { scheme } : {}),
    },
  };

  // A headless manager represents an existing or intentionally skipped server.
  // Keep this path independent of the app's Expo installation.
  if (headless) {
    const url = `http://localhost:${port}`;
    if (env.EXPO_E2E_TEST) {
      console.info(`[__EXPO_E2E_TEST:server] ${JSON.stringify({ url })}`);
    }
    Log.log(chalk`Waiting on {underline ${url}}`);

    return {
      async stopAsync() {},
    };
  }

  let expoCliPath: string;
  try {
    expoCliPath = require.resolve("expo/bin/cli", { paths: [projectRoot] });
  } catch {
    throw new Error(
      `Could not find Expo CLI in ${path.join(projectRoot, "node_modules")}. Install the app dependencies before starting the bundler.`,
    );
  }

  // Resolve the CLI modules relative to the app's Expo installation. This
  // keeps the Metro version and its supporting CLI modules in sync with the
  // app while still allowing expo-desktop to avoid a direct CLI dependency.
  const expoRequire = createRequire(expoCliPath);
  const { DevServerManager } = expoRequire(
    "@expo/cli/build/src/start/server/DevServerManager",
  ) as ExpoCliModules;
  const { startInterfaceAsync } = expoRequire(
    "@expo/cli/build/src/start/interface/startInterface",
  ) as ExpoCliModules;

  const manager = await DevServerManager.startMetroAsync(projectRoot, options);

  // Present the Terminal UI.
  if (!headless && isInteractive()) {
    // Only read the config if we are going to use the results.
    const { exp } = getConfig(projectRoot, {
      // We don't need very many fields here, just use the lightest possible read.
      skipSDKVersionRequirement: true,
      skipPlugins: true,
    });
    await startInterfaceAsync(manager, {
      platforms: exp.platforms ?? [],
    });
  } else {
    // Display the server location in CI...
    const url = manager.getDefaultDevServer()?.getDevServerUrl();

    if (url) {
      if (env.EXPO_E2E_TEST) {
        // Print the URL to stdout for tests
        console.info(`[__EXPO_E2E_TEST:server] ${JSON.stringify({ url })}`);
      }
      Log.log(chalk`Waiting on {underline ${url}}`);
    }
  }

  if (!options.headless) {
    await manager.watchEnvironmentVariables();
    await manager.bootstrapTypeScriptAsync();
  }

  return manager;
}
