import type { EnvOutput } from "@expo/env/build/parse.js";

import * as env from "@expo/env";

/**
 * Set the environment to production or development
 * lots of tools use this to determine if they should run in a dev mode.
 * @see https://github.com/expo/expo/blob/1976cf343b3792c19a9489d35d8282f7121ef7c1/packages/%40expo/cli/src/utils/nodeEnv.ts#L32
 */
export function setNodeEnv(mode: "development" | "production") {
  process.env.NODE_ENV = process.env.NODE_ENV || mode;
  process.env.BABEL_ENV = process.env.BABEL_ENV || process.env.NODE_ENV;
  (globalThis as any).__DEV__ = process.env.NODE_ENV !== "production";

  // event("mode", {
  //   nodeEnv: process.env.NODE_ENV,
  //   babelEnv: process.env.BABEL_ENV,
  //   mode,
  // });
}

let prevEnvKeys: Set<string> | undefined;

/**
 * Load the dotenv files into the current `process.env` scope.
 * Note, this requires `NODE_ENV` being set through `setNodeEnv`.
 */
export function loadEnvFiles(projectRoot: string, options?: LoadEnvFilesOptions) {
  const params = {
    ...options,
    silent: !!options?.silent, // || shouldReduceLogs(),
    force: !!options?.force,
    systemEnv: process.env,
  };
  if (process.env.NODE_ENV) {
    params.mode = process.env.NODE_ENV;
  }

  const envInfo = env.loadProjectEnv(projectRoot, params);
  const envOutput: EnvOutput = {};
  if (envInfo.result === "loaded") {
    prevEnvKeys = new Set();
    for (const key of envInfo.loaded) {
      envOutput[key] = envInfo.env[key] ?? undefined;
      prevEnvKeys.add(key);
    }
  }

  if (envInfo.result === "loaded") {
    // event("load", {
    //   mode: params.mode,
    //   files: envInfo.files.map((file) => event.path(file)),
    //   env: envOutput,
    // });
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
