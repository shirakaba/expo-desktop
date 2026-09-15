import type { BuildArch } from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";

import fs from "node:fs";
import path from "node:path";

import { CommandError } from "../../common/expo/error.ts";

const PACKAGE_PROJECT_NAME = "MyApp.Package";

export type WindowsBuildArtifacts = {
  /** Directory containing the architecture output and MyApp.Package. */
  windowsRoot: string;
  /** Loose app layout used by RNW to deploy the build. */
  layoutRoot: string;
  /** Installable packages and framework dependencies used by RNW during deployment. */
  appPackagesRoot: string;
  /** Package directories matching the selected architecture and configuration. */
  packageDirectories: string[];
};

type WindowsBuildArtifactPaths = Omit<WindowsBuildArtifacts, "packageDirectories">;

/**
 * Locate and validate a previously-built set of Windows artifacts.
 *
 * The input may be the artifact root itself, a project containing a `windows`
 * directory, or a path inside either of the two generated artifact trees.
 */
export async function resolveWindowsBuildArtifactsAsync(
  input: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<WindowsBuildArtifacts> {
  const resolvedInput = path.resolve(input);
  if (!(await isDirectoryAsync(resolvedInput))) {
    throw new CommandError(
      "WINDOWS_BINARY",
      `The path to the Windows build artifacts must be a directory: ${resolvedInput}`,
    );
  }

  const candidates = getWindowsRootCandidates(resolvedInput, arch, configuration);
  for (const windowsRoot of candidates) {
    const artifacts = getWindowsBuildArtifactPaths(windowsRoot, arch, configuration);
    const [layouts, packages] = await Promise.all([
      findValidLayoutDirectoriesAsync(artifacts.layoutRoot),
      findValidPackageDirectoriesAsync(artifacts.appPackagesRoot, arch, configuration),
    ]);
    if (layouts.length > 0 && packages.length > 0) {
      return { ...artifacts, packageDirectories: packages };
    }
  }

  const layoutRelativePath = getLayoutRelativePath(arch, configuration);
  throw new CommandError(
    "WINDOWS_BINARY",
    `Unable to find a complete ${arch} ${configuration} Windows build in: ${resolvedInput}\n` +
      `Expected both "${path.join(layoutRelativePath, "<app>", "AppxManifest.xml")}" ` +
      `with a .build.appxrecipe file, and "${path.join(PACKAGE_PROJECT_NAME, "AppPackages", "<package>", "Add-AppDevPackage.ps1")}".`,
  );
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
    copyPackageDirectoriesReplacingAsync(
      artifacts,
      destination.appPackagesRoot,
      arch,
      configuration,
    ),
  ]);

  return {
    ...destination,
    packageDirectories: artifacts.packageDirectories.map((directory) =>
      path.join(destination.appPackagesRoot, path.basename(directory)),
    ),
  };
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
): WindowsBuildArtifactPaths {
  return {
    windowsRoot,
    layoutRoot: path.join(windowsRoot, getLayoutRelativePath(arch, configuration)),
    appPackagesRoot: path.join(windowsRoot, PACKAGE_PROJECT_NAME, "AppPackages"),
  };
}

function getLayoutRelativePath(arch: BuildArch, configuration: "Debug" | "Release"): string {
  // RNW places x86 layouts directly under windows/Debug or windows/Release.
  return arch === "x86" ? configuration : path.join(arch, configuration);
}

function getWindowsRootCandidates(
  input: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): string[] {
  const candidates = [input, path.join(input, "windows")];
  const parent = path.dirname(input);
  const grandparent = path.dirname(parent);

  // Accept windows/<arch>/<configuration> and its immediate app-layout child.
  if (isPathComponent(path.basename(input), configuration)) {
    candidates.push(arch === "x86" ? parent : grandparent);
  } else if (isPathComponent(path.basename(parent), configuration)) {
    candidates.push(arch === "x86" ? grandparent : path.dirname(grandparent));
  }

  // Accept MyApp.Package/AppPackages and an individual package folder within it.
  if (
    isPathComponent(path.basename(input), "AppPackages") &&
    isPathComponent(path.basename(parent), PACKAGE_PROJECT_NAME)
  ) {
    candidates.push(grandparent);
  } else if (
    isPathComponent(path.basename(parent), "AppPackages") &&
    isPathComponent(path.basename(grandparent), PACKAGE_PROJECT_NAME)
  ) {
    candidates.push(path.dirname(grandparent));
  }

  return [...new Set(candidates.map((candidate) => path.resolve(candidate)))];
}

async function findValidLayoutDirectoriesAsync(layoutRoot: string): Promise<string[]> {
  const entries = await readDirectoryAsync(layoutRoot);
  const layouts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = path.join(layoutRoot, entry.name);
        const contents = await readDirectoryAsync(directory);
        const hasManifest = contents.some(
          (item) => item.isFile() && isPathComponent(item.name, "AppxManifest.xml"),
        );
        const hasRecipe = contents.some(
          (item) => item.isFile() && item.name.toLowerCase().endsWith(".build.appxrecipe"),
        );
        return hasManifest && hasRecipe ? directory : undefined;
      }),
  );
  return layouts.filter((layout): layout is string => layout !== undefined);
}

async function findValidPackageDirectoriesAsync(
  appPackagesRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<string[]> {
  const candidates = await findMatchingPackageDirectoriesAsync(
    appPackagesRoot,
    arch,
    configuration,
  );
  const packages = await Promise.all(
    candidates.map(async (directory) =>
      (await isFileAsync(path.join(directory, "Add-AppDevPackage.ps1"))) ? directory : undefined,
    ),
  );
  return packages.filter((directory): directory is string => directory !== undefined);
}

async function findMatchingPackageDirectoriesAsync(
  appPackagesRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<string[]> {
  const packageArchitectures = arch === "x86" ? ["x86", "win32"] : [arch.toLowerCase()];
  const entries = await readDirectoryAsync(appPackagesRoot);

  return entries
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const name = entry.name.toLowerCase();
      const standardPackage = packageArchitectures.some((packageArch) =>
        name.includes(`_${packageArch}_${configuration.toLowerCase()}_`),
      );
      const releaseFallback =
        configuration === "Release" &&
        packageArchitectures.some((packageArch) => name.endsWith(`_${packageArch}_test`));
      return standardPackage || releaseFallback;
    })
    .map((entry) => path.join(appPackagesRoot, entry.name));
}

async function copyPackageDirectoriesReplacingAsync(
  artifacts: WindowsBuildArtifacts,
  destinationRoot: string,
  arch: BuildArch,
  configuration: "Debug" | "Release",
): Promise<void> {
  if (areSamePath(artifacts.appPackagesRoot, destinationRoot)) {
    return;
  }

  const existingPackages = await findMatchingPackageDirectoriesAsync(
    destinationRoot,
    arch,
    configuration,
  );
  await Promise.all(
    existingPackages.map((directory) =>
      fs.promises.rm(directory, { recursive: true, force: true }),
    ),
  );
  await fs.promises.mkdir(destinationRoot, { recursive: true });
  await Promise.all(
    artifacts.packageDirectories.map((directory) =>
      fs.promises.cp(directory, path.join(destinationRoot, path.basename(directory)), {
        recursive: true,
      }),
    ),
  );
}

async function copyDirectoryReplacingAsync(source: string, destination: string): Promise<void> {
  if (areSamePath(source, destination)) {
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

async function isFileAsync(input: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(input)).isFile();
  } catch {
    return false;
  }
}

async function readDirectoryAsync(directory: string): Promise<fs.Dirent[]> {
  try {
    return await fs.promises.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

function isPathComponent(actual: string, expected: string): boolean {
  return actual.toLowerCase() === expected.toLowerCase();
}

function areSamePath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return process.platform === "win32"
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}
