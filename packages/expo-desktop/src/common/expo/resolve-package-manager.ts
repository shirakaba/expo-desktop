import * as PackageManager from "@expo/package-manager";
import spawnAsync from "@expo/spawn-async";
import Debug from "debug";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import semver from "semver";
import * as TOML from "smol-toml";
import { parseDocument } from "yaml";

import { CLI_NAME } from "./cmd.ts";

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

const debug = Debug("expo-desktop:create-app:resolvePackageManager") as typeof console.log;

/** Determine which package manager to use for installing dependencies based on how the process was started. */
export function resolvePackageManager(): PackageManagerName {
  // Attempt to detect if the user started the command using `yarn` or `pnpm` or `bun`
  const userAgent = process.env.npm_config_user_agent;
  debug("npm_config_user_agent:", userAgent);
  if (userAgent?.startsWith("yarn")) {
    return "yarn";
  } else if (userAgent?.startsWith("pnpm")) {
    return "pnpm";
  } else if (userAgent?.startsWith("bun")) {
    return "bun";
  } else if (userAgent?.startsWith("npm")) {
    return "npm";
  }

  // Try availability
  if (isPackageManagerAvailable("yarn")) {
    return "yarn";
  } else if (isPackageManagerAvailable("pnpm")) {
    return "pnpm";
  } else if (isPackageManagerAvailable("bun")) {
    return "bun";
  }

  return "npm";
}

export function isPackageManagerAvailable(manager: PackageManagerName): boolean {
  try {
    execSync(`${manager} --version`, { stdio: "ignore" });
    return true;
  } catch {}
  return false;
}

export function formatRunCommand(packageManager: PackageManagerName, cmd: string) {
  switch (packageManager) {
    case "pnpm":
      return `pnpm run ${cmd}`;
    case "yarn":
      return `yarn ${cmd}`;
    case "bun":
      return `bun run ${cmd}`;
    case "npm":
    default:
      return `npm run ${cmd}`;
  }
}

export function formatSelfCommand(packageManager = resolvePackageManager()) {
  switch (packageManager) {
    case "pnpm":
      return `pnpx ${CLI_NAME}`;
    case "bun":
      return `bunx ${CLI_NAME}`;
    case "yarn":
    case "npm":
    default:
      return `npx ${CLI_NAME}`;
  }
}

function createPackageManager(
  packageManager: PackageManagerName,
  options?: PackageManager.PackageManagerOptions,
) {
  switch (packageManager) {
    case "yarn":
      return new PackageManager.YarnPackageManager(options);
    case "pnpm":
      return new PackageManager.PnpmPackageManager(options);
    case "bun":
      return new PackageManager.BunPackageManager(options);
    case "npm":
    default:
      return new PackageManager.NpmPackageManager(options);
  }
}

export async function installDependenciesAsync(
  projectRoot: string,
  packageManager: PackageManagerName,
  flags: { silent: boolean } = { silent: false },
) {
  const manager = createPackageManager(packageManager, {
    cwd: projectRoot,
    silent: flags.silent,
  });

  try {
    await manager.installAsync();
  } catch (error) {
    // Volta-managed installs of yarn may be missing the "yarnpkg" alias:
    // https://github.com/volta-cli/volta/issues/1391
    if (error instanceof Error && error.message === "spawn yarnpkg ENOENT") {
      Object.defineProperty(manager, "bin", { value: "yarn" });
      await manager.installAsync();
    } else {
      throw error;
    }
  }
}

export async function configurePackageManager(
  projectRoot: string,
  packageManager: PackageManagerName,
): Promise<ConfigurePackageManagerResult> {
  const updatedFiles: string[] = [];
  const manifestFile = path.join(projectRoot, "package.json");
  const manifestResult = await readTemplateManifestAsync(manifestFile, packageManager);
  if (manifestResult.type === "reject") return { ...manifestResult, updatedFiles };
  const manifest = manifestResult.manifest;
  const patches = manifest.patchedDependencies ?? {};
  const hasPatches = Object.keys(patches).length > 0;

  if (packageManager === "yarn" || (packageManager === "npm" && hasPatches)) {
    const versionResult = await resolvePackageManagerMajorVersionAsync(projectRoot, packageManager);
    if (versionResult.type === "reject") return { ...versionResult, updatedFiles };
    const minimumVersion = packageManager === "npm" ? 12 : 2;
    if (hasPatches && versionResult.majorVersion < minimumVersion) {
      return {
        type: "reject",
        subtype: "unsupported patching version",
        packageManager,
        minimumVersion,
        updatedFiles,
      };
    }
    if (packageManager === "yarn" && versionResult.majorVersion < 2) return { type: "resolve" };
  }

  for (const [dependency, patchPath] of Object.entries(patches)) {
    const filePath = path.resolve(projectRoot, patchPath);
    try {
      await fs.access(filePath);
    } catch (error) {
      return {
        type: "reject",
        subtype: "failed to access template patch",
        dependency,
        filePath,
        error,
        updatedFiles,
      };
    }
  }

  // Config commands may target an ancestor workspace despite their cwd. Write
  // only the created app's files, keeping the template's npm patch declarations.
  const configName = {
    npm: ".npmrc",
    bun: "bunfig.toml",
    pnpm: "pnpm-workspace.yaml",
    yarn: ".yarnrc.yml",
  }[packageManager];
  const configFile = path.join(projectRoot, configName);
  let contents = "";
  try {
    contents = await fs.readFile(configFile, "utf8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      return {
        type: "reject",
        subtype: "failed to read package manager configuration",
        filePath: configFile,
        error,
        updatedFiles,
      };
    }
  }
  const configResult = preparePackageManagerConfiguration(
    configFile,
    contents,
    packageManager,
    patches,
  );
  if (configResult.type === "reject") return { ...configResult, updatedFiles };

  let manifestOutput: string | undefined;
  // Yarn needs resolutions in addition to the portable patch declarations.
  // Prepare both outputs before saving either file.
  if (packageManager === "yarn" && hasPatches) {
    const resolutions = { ...manifest.resolutions };
    for (const [dependency, patchPath] of Object.entries(patches)) {
      const versionIndex = dependency.lastIndexOf("@");
      const name = versionIndex > 0 ? dependency.slice(0, versionIndex) : dependency;
      const version = versionIndex > 0 ? dependency.slice(versionIndex + 1) : "*";
      let encodedVersion: string;
      try {
        encodedVersion = encodeURIComponent(version);
      } catch (error) {
        return {
          type: "reject",
          subtype: "failed to encode Yarn patch version",
          filePath: manifestFile,
          dependency,
          version,
          error,
          updatedFiles,
        };
      }
      resolutions[`${name}@npm:${version}`] =
        `patch:${name}@npm%3A${encodedVersion}#./${patchPath}`;
    }
    manifest.resolutions = resolutions;
    try {
      manifestOutput = JSON.stringify(manifest, null, 2) + "\n";
    } catch (error) {
      return {
        type: "reject",
        subtype: "failed to serialize template manifest",
        filePath: manifestFile,
        error,
        updatedFiles,
      };
    }
  }
  try {
    await fs.writeFile(configFile, configResult.output);
  } catch (error) {
    return {
      type: "reject",
      subtype: "failed to write package manager configuration",
      filePath: configFile,
      error,
      updatedFiles,
    };
  }
  updatedFiles.push(configFile);
  if (manifestOutput !== undefined) {
    try {
      await fs.writeFile(manifestFile, manifestOutput);
    } catch (error) {
      return {
        type: "reject",
        subtype: "failed to write template manifest",
        filePath: manifestFile,
        error,
        updatedFiles,
      };
    }
    updatedFiles.push(manifestFile);
  }
  return { type: "resolve" };
}

async function readTemplateManifestAsync(
  filePath: string,
  packageManager: PackageManagerName,
): Promise<ReadTemplateManifestResult> {
  let contents: string;
  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    return { type: "reject", subtype: "failed to read template manifest", filePath, error };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(contents);
  } catch (error) {
    return { type: "reject", subtype: "failed to parse template manifest", filePath, error };
  }
  if (!isRecord(manifest)) {
    return { type: "reject", subtype: "invalid template manifest", filePath, field: "root" };
  }
  const fields =
    packageManager === "yarn"
      ? (["patchedDependencies", "resolutions"] as const)
      : (["patchedDependencies"] as const);
  for (const field of fields) {
    const value = manifest[field];
    if (
      value !== undefined &&
      (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== "string"))
    ) {
      return { type: "reject", subtype: "invalid template manifest", filePath, field };
    }
  }
  return { type: "resolve", manifest: manifest as TemplateManifest };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function resolvePackageManagerMajorVersionAsync(
  projectRoot: string,
  packageManager: PackageManagerName,
): Promise<ResolvePackageManagerMajorVersionResult> {
  let version: string;
  try {
    const result = await spawnAsync(packageManager, ["--version"], { cwd: projectRoot });
    version = result.stdout.trim();
  } catch (error) {
    return {
      type: "reject",
      subtype: "failed to resolve package manager version",
      packageManager,
      error,
    };
  }

  let majorVersion: number;
  try {
    majorVersion = semver.major(version);
  } catch (error) {
    return {
      type: "reject",
      subtype: "failed to parse package manager version",
      packageManager,
      version,
      error,
    };
  }
  return { type: "resolve", majorVersion };
}

function preparePackageManagerConfiguration(
  filePath: string,
  contents: string,
  packageManager: PackageManagerName,
  patches: Record<string, string>,
): PreparePackageManagerConfigurationResult {
  switch (packageManager) {
    case "npm": {
      const stripped = contents.replace(/^[ \t]*install-strategy[ \t]*=.*(?:\r?\n|$)/gm, "");
      return {
        type: "resolve",
        output: `${stripped}${stripped && !stripped.endsWith("\n") ? "\n" : ""}install-strategy=hoisted\n`,
      };
    }
    case "bun": {
      let bunfig: TOML.TomlTable;
      try {
        bunfig = TOML.parse(contents);
      } catch (error) {
        return { type: "reject", subtype: "failed to parse Bun configuration", filePath, error };
      }
      if (bunfig.install !== undefined && !isRecord(bunfig.install)) {
        return { type: "reject", subtype: "invalid Bun install configuration", filePath };
      }
      bunfig.install = { ...(bunfig.install as TOML.TomlTable | undefined), linker: "hoisted" };
      let output: string;
      try {
        output = TOML.stringify(bunfig);
      } catch (error) {
        return {
          type: "reject",
          subtype: "failed to serialize Bun configuration",
          filePath,
          error,
        };
      }
      return { type: "resolve", output };
    }
    case "pnpm":
    case "yarn": {
      let config: ReturnType<typeof parseDocument>;
      try {
        config = parseDocument(contents);
      } catch (error) {
        return { type: "reject", subtype: "failed to parse YAML configuration", filePath, error };
      }
      if (config.errors.length) {
        return {
          type: "reject",
          subtype: "failed to parse YAML configuration",
          filePath,
          error: config.errors[0],
        };
      }
      try {
        config.set("nodeLinker", packageManager === "pnpm" ? "hoisted" : "node-modules");
      } catch (error) {
        return { type: "reject", subtype: "failed to set YAML node linker", filePath, error };
      }
      if (packageManager === "pnpm") {
        for (const [dependency, patchPath] of Object.entries(patches)) {
          try {
            config.setIn(["patchedDependencies", dependency], patchPath);
          } catch (error) {
            return {
              type: "reject",
              subtype: "failed to register pnpm patch",
              filePath,
              dependency,
              error,
            };
          }
        }
      }
      let output: string;
      try {
        output = config.toString();
      } catch (error) {
        return {
          type: "reject",
          subtype: "failed to serialize YAML configuration",
          filePath,
          error,
        };
      }
      return { type: "resolve", output };
    }
  }
}

interface TemplateManifest extends Record<string, unknown> {
  patchedDependencies?: Record<string, string>;
  resolutions?: Record<string, string>;
}

type FileError<Subtype extends string> = {
  type: "reject";
  subtype: Subtype;
  filePath: string;
  error: unknown;
};

type ReadTemplateManifestResult =
  | { type: "resolve"; manifest: TemplateManifest }
  | FileError<"failed to read template manifest" | "failed to parse template manifest">
  | { type: "reject"; subtype: "invalid template manifest"; filePath: string; field: string };

type ResolvePackageManagerMajorVersionResult =
  | { type: "resolve"; majorVersion: number }
  | {
      type: "reject";
      subtype: "failed to resolve package manager version";
      packageManager: PackageManagerName;
      error: unknown;
    }
  | {
      type: "reject";
      subtype: "failed to parse package manager version";
      packageManager: PackageManagerName;
      version: string;
      error: unknown;
    };

type PreparePackageManagerConfigurationResult =
  | { type: "resolve"; output: string }
  | FileError<
      | "failed to parse Bun configuration"
      | "failed to serialize Bun configuration"
      | "failed to parse YAML configuration"
      | "failed to set YAML node linker"
      | "failed to serialize YAML configuration"
    >
  | { type: "reject"; subtype: "invalid Bun install configuration"; filePath: string }
  | (FileError<"failed to register pnpm patch"> & { dependency: string });

export type ConfigurePackageManagerResult =
  | { type: "resolve" }
  | ((
      | Extract<ReadTemplateManifestResult, { type: "reject" }>
      | Extract<ResolvePackageManagerMajorVersionResult, { type: "reject" }>
      | Extract<PreparePackageManagerConfigurationResult, { type: "reject" }>
      | {
          type: "reject";
          subtype: "unsupported patching version";
          packageManager: PackageManagerName;
          minimumVersion: number;
        }
      | (FileError<"failed to access template patch"> & { dependency: string })
      | (FileError<"failed to encode Yarn patch version"> & { dependency: string; version: string })
      | FileError<
          | "failed to read package manager configuration"
          | "failed to write package manager configuration"
          | "failed to serialize template manifest"
          | "failed to write template manifest"
        >
    ) & { updatedFiles: string[] });
