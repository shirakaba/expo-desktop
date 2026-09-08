import spawnAsync from "@expo/spawn-async";
import { createRequire } from "node:module";
import path from "node:path";

import type { BuildProps } from "./WindowsBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";

const require = createRequire(import.meta.url);

/**
 * Spawn the `rnc-cli` process to create and deploy the Windows app binary.
 *
 * RNW's CLI owns MSBuild, NuGet restore, autolinking, packaging, and deployment.
 * We invoke the app's installed CLI rather than adding it to expo-desktop's
 * dependencies, just as the bundler is started through the app's installed Expo CLI.
 */
export async function buildAsync(props: BuildProps): Promise<void> {
  if (!props.buildCache) {
    await cleanAsync(props);
  }

  await runRncCliAsync(props, ["--no-deploy"]);
}

/** Deploy the already-built Windows app to the host device and launch it. */
export async function deployAsync(props: BuildProps): Promise<void> {
  await runRncCliAsync(props, ["--no-build", "--no-autolink"]);
}

async function runRncCliAsync(props: BuildProps, extraArgs: string[]): Promise<void> {
  let cliPath: string;
  try {
    cliPath = require.resolve("@react-native-community/cli/build/bin.js", {
      paths: [props.projectRoot],
    });
  } catch {
    throw new CommandError(
      "WINDOWS_CLI",
      "Could not find the React Native Community CLI in the project. Install `@react-native-community/cli` before running the Windows app.",
    );
  }

  const args = [
    cliPath,
    "run-windows",
    "--no-packager",
    "--sln",
    toCliPath(props.projectRoot, props.windowsProject.solution),
    "--proj",
    toCliPath(props.projectRoot, props.windowsProject.project),
  ];

  if (props.configuration === "Release") {
    args.push("--release");
  }

  args.push(...extraArgs);

  Log.debug(`  ${process.execPath} ${args.join(" ")}`);
  await spawnAsync(process.execPath, args, {
    cwd: props.projectRoot,
    env: {
      ...process.env,
      RCT_METRO_PORT: String(props.port),
    },
    stdio: "inherit",
  });
}

async function cleanAsync(props: BuildProps): Promise<void> {
  let rnwCliPath: string;
  try {
    rnwCliPath = require.resolve("@react-native-windows/cli", {
      paths: [props.projectRoot],
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
        architecture: WindowsArchitecture,
        verbose: boolean,
      ): {
        msbuildPath(): string;
      };
    };
  };

  Log.log("› Cleaning the Windows native build output");
  const buildTools = MSBuildTools.findAvailableVersion(getHostArchitecture(), false);
  for (const architecture of WINDOWS_ARCHITECTURES) {
    await spawnAsync(
      path.join(buildTools.msbuildPath(), "msbuild.exe"),
      [
        props.windowsProject.solution,
        "/t:Clean",
        `/p:Configuration=${props.configuration}`,
        `/p:Platform=${architecture}`,
      ],
      { stdio: "inherit" },
    );
  }
}

function toCliPath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath);
}

type WindowsArchitecture = "x86" | "x64" | "ARM64";
const WINDOWS_ARCHITECTURES: WindowsArchitecture[] = ["x86", "x64", "ARM64"];

function getHostArchitecture(): WindowsArchitecture {
  switch (process.arch) {
    case "arm64":
      return "ARM64";
    case "ia32":
      return "x86";
    default:
      return "x64";
  }
}
