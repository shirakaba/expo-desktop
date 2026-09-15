import type { Config, CommandOption } from "@react-native-community/cli-types";
import type {
  BuildArch,
  RunWindowsOptions,
} from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";

import { createRequire } from "node:module";
import * as process from "node:process";

import { CommandError } from "../../common/expo/error.ts";
const require = createRequire(import.meta.url);

/**
 *
 */
export async function runWindows(config: Config, options: RunWindowsOptions) {
  const { func } = getRunWindowsCommand();
  await func([], config, options);
}

function getRunWindowsCommand() {
  const runWindowsModule = requireRNWCLI();

  const runWindowsCommand = runWindowsModule.commands.find(({ name }) => name === "run-windows");
  if (!runWindowsCommand) {
    throw new CommandError(
      "NO_RNW_CLI_RUN_WINDOWS_COMMAND",
      "Unable to find the 'run-windows' command inside @react-native-windows/cli.",
    );
  }

  return runWindowsCommand;
}

function requireRNWCLI(): typeof import("@react-native-windows/cli") {
  try {
    return require("@react-native-windows/cli");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "MODULE_NOT_FOUND") {
      throw error;
    }

    throw new CommandError(
      "NO_RNW_CLI",
      "Unable to find @react-native-windows/cli. Please make sure you have it (or react-native-windows) installed.",
    );
  }
}

export function parseArch(arch = deviceArchitecture()): BuildArch {
  const { options } = getRunWindowsCommand();
  const archOption = options?.find(({ name }) => name === "--arch [string]");
  if (!archOption) {
    throw new Error("Unable to find '--arch [string]' option");
  }
  const { parse: parseBuildArch } = archOption;
  if (!parseBuildArch) {
    throw new Error("Unable to find parser for '--arch [string]' option");
  }

  return parseBuildArch(arch);
}

export function parseDirectDebuggingPort(arg: string) {
  const num = parseInt(arg, 10);
  if (!Number.isInteger(num)) {
    throw new Error(`Expected argument '--direct-debugging' to be a number`);
  }
  if (num < 1024 || num >= 65535) {
    throw new Error("Direct debugging port it out of range");
  }
  return num;
}

/**
 * Gets the device architecture, like x86/x64/arm64.
 * @returns The device architecture.
 * @see @react-native-windows/telemetry/lib-commonjs/utils/basePropUtils.js
 */
export function deviceArchitecture() {
  const nodeArch = nodeArchitecture();
  // Check if we're running x86 node on x64 hardware
  if (nodeArch === "x86" && process.env.PROCESSOR_ARCHITEW6432 === "AMD64") {
    return "x64";
  }
  return nodeArch;
}

/**
 * Gets the node architecture, like x86/x64/arm64.
 * @returns The node architecture.
 * @see @react-native-windows/telemetry/lib-commonjs/utils/basePropUtils.js
 */
function nodeArchitecture() {
  return process.arch === "ia32" ? "x86" : process.arch;
}
