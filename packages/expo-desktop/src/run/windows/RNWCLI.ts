import type { Config } from "@react-native-community/cli-types";
import type { AutoLinkOptions } from "@react-native-windows/cli/lib-commonjs/commands/autolinkWindows/autolinkWindowsOptions.d.ts";
import type {
  BuildArch,
  RunWindowsOptions,
} from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";
import type MSBuildToolsModule from "@react-native-windows/cli/lib-commonjs/utils/msbuildtools.d.ts";

import spawnAsync from "@expo/spawn-async";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";

const require = createRequire(import.meta.url);
const configuredMSBuildTools = new WeakSet<(typeof MSBuildToolsModule)["default"]>();

/**
 *
 */
export async function runWindows(projectRoot: string, config: Config, options: RunWindowsOptions) {
  await runRNWCommand("run-windows", projectRoot, config, options);
}

export async function autolinkWindows(
  projectRoot: string,
  config: Config,
  options: AutoLinkOptions,
) {
  await runRNWCommand("autolink-windows", projectRoot, config, options);
}

async function runRNWCommand(
  commandName: "autolink-windows" | "run-windows",
  projectRoot: string,
  config: Config,
  options: AutoLinkOptions | RunWindowsOptions,
) {
  const { func } = getRNWCommand(commandName, projectRoot);
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

function getRNWCommand(commandName: "autolink-windows" | "run-windows", projectRoot: string) {
  const runWindowsModule = requireRNWCLI(projectRoot);

  const command = runWindowsModule.commands.find(({ name }) => name === commandName);
  if (!command) {
    throw new CommandError(
      "NO_RNW_CLI_COMMAND",
      `Unable to find the '${commandName}' command inside @react-native-windows/cli.`,
    );
  }

  return command;
}

function requireRNWCLI(projectRoot: string): typeof import("@react-native-windows/cli") {
  const projectRequire = createRequire(path.join(projectRoot, "package.json"));

  try {
    const rnwCli = projectRequire("@react-native-windows/cli");
    configureRNWMSBuildTools(projectRoot, projectRequire);
    return rnwCli;
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

/**
 * RNW 0.81's MSBuild helper always returns the x64 MSBuild directory. On an
 * ARM64 host that launches an emulated x64 MSBuild process, which makes the
 * C++ targets select the 32-bit HostX86 compiler and can exhaust its PCH
 * address space. Keep the RNW helper, but redirect its selected installation
 * to the native ARM64 MSBuild directory when it exists.
 */
function configureRNWMSBuildTools(
  projectRoot: string,
  projectRequire = createRequire(path.join(projectRoot, "package.json")),
) {
  if (process.arch !== "arm64") {
    return;
  }

  const rnwCliPath = projectRequire.resolve("@react-native-windows/cli");
  const msbuildToolsPath = path.join(path.dirname(rnwCliPath), "utils", "msbuildtools.js");
  const { default: MSBuildTools } = projectRequire(msbuildToolsPath) as typeof MSBuildToolsModule;
  if (configuredMSBuildTools.has(MSBuildTools)) {
    return;
  }

  configuredMSBuildTools.add(MSBuildTools);
  const originalMSBuildPath = MSBuildTools.prototype.msbuildPath;

  MSBuildTools.prototype.msbuildPath = function () {
    const x64Path = originalMSBuildPath.call(this);
    const arm64Path = path.join(path.dirname(x64Path), "arm64");
    return existsSync(path.join(arm64Path, "MSBuild.exe")) ? arm64Path : x64Path;
  };
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

  configureRNWMSBuildTools(projectRoot);

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

export function parseArch(projectRoot: string, arch = deviceArchitecture()): BuildArch {
  const { options } = getRNWCommand("run-windows", projectRoot);
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
