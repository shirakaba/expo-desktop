import type { Config } from "@react-native-community/cli-types";

import { createRequire } from "node:module";

import { CommandError } from "../common/expo/error.ts";
const require = createRequire(import.meta.url);

export function loadConfigAsync(args: { projectRoot?: string; selectedPlatform?: string }) {
  let cliConfigModule: {
    loadConfigAsync({}: { projectRoot?: string; selectedPlatform?: string }): Promise<Config>;
  };
  try {
    cliConfigModule = require("@react-native-community/cli-config");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    throw new CommandError(
      "NO_RNCLI_CONFIG",
      "Unable to find @react-native-community/cli-config. Please make sure you have it (or @react-native-community/cli) installed.",
    );
  }
  return cliConfigModule.loadConfigAsync(args);
}
