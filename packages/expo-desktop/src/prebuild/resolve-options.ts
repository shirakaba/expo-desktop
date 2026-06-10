import type { ModPlatform } from "@expo/config-plugins";

import chalk from "chalk";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

import { validateUrl } from "./validate-url.ts";

const debug = require("debug")("expo-desktop:prebuild:resolveOptions") as typeof console.log;

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
