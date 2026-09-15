import type { Config, CommandOption } from "@react-native-community/cli-types";
import type { AutoLinkOptions } from "@react-native-windows/cli/lib-commonjs/commands/autolinkWindows/autolinkWindowsOptions.d.ts";
import type {
  BuildArch,
  RunWindowsOptions,
} from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";

import spawnAsync from "@expo/spawn-async";
import { createRequire } from "node:module";
import path from "node:path";

import type { BuildProps } from "./WindowsBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
const require = createRequire(import.meta.url);

/**
 *
 */
export async function runWindows(config: Config, options: RunWindowsOptions) {
  await runRNWCommand("run-windows", config, options);
}

export async function autolinkWindows(config: Config, options: AutoLinkOptions) {
  await runRNWCommand("autolink-windows", config, options);
}

async function runRNWCommand(
  commandName: "autolink-windows" | "run-windows",
  config: Config,
  options: AutoLinkOptions | RunWindowsOptions,
) {
  const { func } = getRNWCommand(commandName);
  const previousExitCode = process.exitCode;
  let exitCode: typeof process.exitCode;

  // The RNW command catches its own errors and reports them through exitCode.
  // Isolate each invocation so a failure cannot fall through to the next phase.
  process.exitCode = undefined;
  try {
    await func([], config, options);
    exitCode = process.exitCode;
  } finally {
    process.exitCode = previousExitCode;
  }

  if (exitCode !== undefined && exitCode !== 0) {
    throw new CommandError(
      "RNW_CLI",
      `React Native Windows CLI command '${commandName}' failed with exit code ${exitCode}.`,
    );
  }
}

function getRNWCommand(commandName: "autolink-windows" | "run-windows") {
  const runWindowsModule = requireRNWCLI();

  const command = runWindowsModule.commands.find(({ name }) => name === commandName);
  if (!command) {
    throw new CommandError(
      "NO_RNW_CLI_COMMAND",
      `Unable to find the '${commandName}' command inside @react-native-windows/cli.`,
    );
  }

  return command;
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

export async function cleanAsync({
  arch,
  configuration,
  projectRoot,
  solution,
}: {
  arch: "x86" | "x64" | "ARM64";
  configuration: "Debug" | "Release";
  projectRoot: string;
  solution: string;
}): Promise<void> {
  let rnwCliPath: string;
  try {
    rnwCliPath = require.resolve("@react-native-windows/cli", {
      paths: [projectRoot],
    });
  } catch {
    throw new CommandError(
      "WINDOWS_CLI",
      "Could not find the React Native Windows CLI in the project. Install `react-native-windows` before running the Windows app.",
    );
  }

  const msbuildToolsPath = path.join(path.dirname(rnwCliPath), "utils", "msbuildtools.js");
  const { default: MSBuildTools } = require(msbuildToolsPath) as {
    default: {
      findAvailableVersion(
        architecture: "x86" | "x64" | "ARM64",
        verbose: boolean,
      ): {
        msbuildPath(): string;
      };
    };
  };

  Log.log("› Cleaning the Windows native build output");
  const buildTools = MSBuildTools.findAvailableVersion(arch, false);
  await spawnAsync(
    path.join(buildTools.msbuildPath(), "msbuild.exe"),
    [solution, "/t:Clean", `/p:Configuration=${configuration}`, `/p:Platform=${arch}`],
    { stdio: "inherit" },
  );
}

export function parseArch(arch = deviceArchitecture()): BuildArch {
  const { options } = getRNWCommand("run-windows");
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
