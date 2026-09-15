import type { BuildArch } from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";

import fs from "node:fs";
import path from "node:path";

import { CommandError } from "../../common/expo/error.ts";

const PACKAGE_PROJECT_NAME = "MyApp.Package";

export type WindowsBuildArtifacts = {
  /** Root of the preserved Windows build output. */
  windowsRoot: string;
  /** Loose app layout used by RNW to deploy the build. */
  layoutRoot: string;
  /** Installable packages and framework dependencies used by RNW during deployment. */
  appPackagesRoot: string;
};

/** Resolve the two generated directories required by RNW's no-build deployment. */
export async function resolveWindowsBuildArtifactsAsync(
  windowsRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<WindowsBuildArtifacts> {
  const artifacts = getWindowsBuildArtifactPaths(path.resolve(windowsRoot), arch, configuration);
  const missing = (
    await Promise.all(
      [artifacts.layoutRoot, artifacts.appPackagesRoot].map(async (directory) => ({
        directory,
        exists: await isDirectoryAsync(directory),
      })),
    )
  ).filter(({ exists }) => !exists);

  if (missing.length > 0) {
    throw new CommandError(
      "WINDOWS_BINARY",
      `The Windows artifact directory is incomplete: ${artifacts.windowsRoot}\n` +
        `Missing ${missing.map(({ directory }) => `"${directory}"`).join(" and ")}. ` +
        "Pass the Windows directory from a native build, or a directory previously created with --output.",
    );
  }

  return artifacts;
}

/** Restore an artifact bundle to the locations expected by RNW's no-build deployment. */
export async function restoreWindowsBuildArtifactsAsync(
  artifacts: WindowsBuildArtifacts,
  destinationWindowsRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<WindowsBuildArtifacts> {
  const destination = getWindowsBuildArtifactPaths(
    path.resolve(destinationWindowsRoot),
    arch,
    configuration,
  );

  await Promise.all([
    copyDirectoryReplacingAsync(artifacts.layoutRoot, destination.layoutRoot),
    copyDirectoryReplacingAsync(artifacts.appPackagesRoot, destination.appPackagesRoot),
  ]);

  return destination;
}

/** Export the generated files as a self-contained artifact accepted by `--binary`. */
export async function exportWindowsBuildArtifactsAsync(
  artifacts: WindowsBuildArtifacts,
  outputDirectory: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<WindowsBuildArtifacts> {
  return await restoreWindowsBuildArtifactsAsync(
    artifacts,
    path.resolve(outputDirectory),
    arch,
    configuration,
  );
}

function getWindowsBuildArtifactPaths(
  windowsRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): WindowsBuildArtifacts {
  return {
    windowsRoot,
    layoutRoot:
      arch === "x86"
        ? path.join(windowsRoot, configuration)
        : path.join(windowsRoot, arch, configuration),
    appPackagesRoot: path.join(windowsRoot, PACKAGE_PROJECT_NAME, "AppPackages"),
  };
}

async function copyDirectoryReplacingAsync(source: string, destination: string): Promise<void> {
  if (path.resolve(source) === path.resolve(destination)) {
    return;
  }

  await fs.promises.rm(destination, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(destination), { recursive: true });
  await fs.promises.cp(source, destination, { recursive: true });
}

async function isDirectoryAsync(input: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(input)).isDirectory();
  } catch {
    return false;
  }
}
