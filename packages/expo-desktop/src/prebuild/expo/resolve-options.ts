import chalk from "chalk";
import Debug from "debug";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { validateUrl } from "../validate-url.ts";

const debug = Debug("expo-desktop:prebuild:resolveOptions") as typeof console.log;

export function resolvePackageManagerOptions({
  noInstall,
  npm,
  yarn,
  bun,
  pnpm,
}: {
  noInstall: boolean | undefined;
  npm: boolean | undefined;
  yarn: boolean | undefined;
  bun: boolean | undefined;
  pnpm: boolean | undefined;
}) {
  const managers = {
    npm: !!npm,
    yarn: !!yarn,
    pnpm: !!pnpm,
    bun: !!bun,
  } as const satisfies Record<string, boolean>;

  if (
    [managers.npm, managers.pnpm, managers.yarn, managers.bun, !!noInstall].filter(Boolean).length >
    1
  ) {
    throw new Error("Specify at most one of: --no-install, --npm, --pnpm, --yarn, --bun");
  }

  for (const [manager, value] of Object.entries(managers)) {
    if (!value) {
      continue;
    }
    return manager as "npm" | "yarn" | "bun" | "pnpm";
  }
}

/** Resolves dependencies to skip from a string joined by `,`. Example: `react-native,expo,lodash` */
export function resolveSkipDependencyUpdate(value: any) {
  if (!value || typeof value !== "string") {
    return [];
  }
  return value.split(",");
}

/** Resolves a template option as a URL or file path pointing to a tar file. */
export function resolveTemplateOption(template: string): ResolvedTemplateOption {
  assert(template, "template is required");

  if (
    // Expands github shorthand (owner/repo) to full URLs
    template.includes("/") &&
    !(
      template.startsWith("@") || // Scoped package
      template.startsWith(".") || // Relative path
      template.startsWith(path.sep) || // Absolute path
      // Contains a protocol
      /^[a-z][-a-z0-9\\.\\+]*:/.test(template)
    )
  ) {
    template = `https://github.com/${template}`;
  }

  if (template.startsWith("https://") || template.startsWith("http://")) {
    if (!validateUrl(template)) {
      throw new Error("Invalid URL provided as a template");
    }
    debug("Resolved template to repository path:", template);
    return { type: "repository", uri: template };
  }

  if (
    // Supports `file:./path/to/template.tgz`
    template.startsWith("file:") ||
    // Supports `../path/to/template.tgz`
    template.startsWith(".") ||
    // Supports `\\path\\to\\template.tgz`
    template.startsWith(path.sep)
  ) {
    let resolvedUri = template;
    if (resolvedUri.startsWith("file:")) {
      resolvedUri = resolvedUri.substring(5);
    }
    const templatePath = path.resolve(resolvedUri);
    assert(fs.existsSync(templatePath), "template file does not exist: " + templatePath);
    assert(
      fs.statSync(templatePath).isFile(),
      "template must be a tar file created by running `npm pack` in a project: " + templatePath,
    );

    debug(`Resolved template to file path:`, templatePath);
    return { type: "file", uri: templatePath };
  }

  if (fs.existsSync(template)) {
    // Backward compatible with the old local template argument, e.g. `--template dir/template.tgz`
    const templatePath = path.resolve(template);
    debug(`Resolved template to file path:`, templatePath);
    return { type: "file", uri: templatePath };
  }

  debug(`Resolved template to NPM package:`, template);
  return { type: "npm", uri: template };
}

export interface ResolvedTemplateOption {
  type: "file" | "npm" | "repository";
  uri: string;
}

/**
 * Warns and filters out unsupported platforms based on the runtime constraints.
 * Essentially this means no iOS or macOS on Windows devices.
 */
export function ensureValidPlatforms(
  platforms: Array<"ios" | "android" | "macos" | "windows">,
): Array<"ios" | "android" | "macos" | "windows"> {
  // Skip prebuild for iOS and macOS on Windows
  if (process.platform === "win32" && (platforms.includes("ios") || platforms.includes("macos"))) {
    Log.warn(
      chalk`⚠️  Skipping generating the iOS / macOS native project files. Run {bold npx expo prebuild} again from macOS or Linux to generate the iOS and/or macOS projects.\n`,
    );
    return platforms.filter((platform) => platform !== "ios" && platform !== "macos");
  }
  return platforms;
}

/** Asserts platform length must be greater than zero. */
export function assertPlatforms(platforms: Array<"ios" | "android" | "macos" | "windows">) {
  if (!platforms?.length) {
    throw new CommandError("At least one platform must be enabled when syncing");
  }
}
