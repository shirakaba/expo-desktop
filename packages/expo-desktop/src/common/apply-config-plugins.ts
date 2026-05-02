import * as fs from "node:fs";
import { createRequire } from "node:module";

import type { ProjectInfo } from "./apply-config-plugins-types.ts";

import { withInternal } from "./with-internal.ts";

const require = createRequire(import.meta.url);
const { withPlugins } = require("@expo/config-plugins");
const { compileModsAsync } = require("expo-desktop-config-plugins");

/**
 * Applies config plugins.
 * @see https://github.com/microsoft/react-native-test-app/blob/trunk/packages/app/scripts/config-plugins/apply.mjs
 */
export async function applyConfigPlugins({
  appJsonPath,
  ...info
}: ProjectInfo): Promise<Awaited<ReturnType<typeof compileModsAsync>> | undefined> {
  if (!appJsonPath) {
    return;
  }

  const content = fs.readFileSync(appJsonPath, { encoding: "utf-8" });
  const appConfig = JSON.parse(content);
  const { expo: expoConfig } = appConfig;
  const { plugins } = expoConfig;
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return;
  }

  return compileModsAsync(withPlugins(withInternal(expoConfig, info), plugins), info);
}
