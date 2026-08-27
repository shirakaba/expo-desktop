import * as env from "@expo/env";
import * as process from "node:process";

/**
 * Set the environment to production or development
 * lots of tools use this to determine if they should run in a dev mode.
 */
export function setNodeEnv(mode: "development" | "production") {
  process.env.NODE_ENV = process.env.NODE_ENV || mode;
  process.env.BABEL_ENV = process.env.BABEL_ENV || process.env.NODE_ENV;
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = process.env.NODE_ENV !== "production";
}

/**
 * Load the dotenv files into the current `process.env` scope.
 * Note, this requires `NODE_ENV` being set through `setNodeEnv`.
 */
export function loadEnvFiles(projectRoot: string, options?: LoadEnvFilesOptions) {
  const params = {
    ...options,
    silent: !!options?.silent,
    force: !!options?.force,
    mode: process.env.NODE_ENV,
    systemEnv: process.env,
  } as NonNullable<Parameters<(typeof env)["loadProjectEnv"]>[1]>;

  const envInfo = env.loadProjectEnv(projectRoot, params);
  const envOutput: EnvOutput = {};
  if (envInfo.result === "loaded") {
    prevEnvKeys = new Set();
    for (const key of envInfo.loaded) {
      envOutput[key] = envInfo.env[key] ?? undefined;
      prevEnvKeys.add(key);
    }
  }

  if (!params.silent) {
    env.logLoadedEnv(envInfo, params);
  }
  return process.env;
}

interface LoadEnvFilesOptions {
  force?: boolean;
  silent?: boolean;
  mode?: string;
}

let prevEnvKeys: Set<string> | undefined;

type EnvOutput = Record<string, string | undefined>;
