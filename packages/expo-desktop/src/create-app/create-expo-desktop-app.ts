import type { ModPlatform } from "@expo/config-plugins";

import { log, tasks } from "@clack/prompts";
import { type } from "arktype";
import Debug from "debug";
import { glob } from "glob";
import { cyan, green, yellow } from "kleur/colors";
import { spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { platform } from "node:process";
import process from "node:process";

import { AppJson, PackageJson } from "../common/app-json.ts";
import { makePrettySummary } from "../common/arktype.ts";
import { title } from "../common/clack.ts";
import {
  type CreateAsyncOptions,
  setupDependenciesAsync,
} from "../common/expo/create-async-utils.ts";
import { generateAgentFiles } from "../common/expo/generate-agent-files.ts";
import { initGitRepoAsync } from "../common/expo/git.ts";
import { extractAndPrepareTemplateAppAsync } from "../common/expo/template.ts";

const debug = Debug("expo-desktop:create-app:git") as typeof console.log;

export async function createExpoDesktopApp({
  agentsMd,
  yes,
  install,
  localDev,
  name,
  packageManager,
  template,
  versions,
}: {
  agentsMd: boolean;
  yes: boolean;
  install: boolean;
  /**
   * A crude switch to use to help with local development.
   *
   * - Skips the questionnaire at the start.
   * - Installs the local copy of expo-desktop-config-plugins rather than pinning
   *   to a published release.
   * - Adds the apply-config-plugins.mjs script.
   */
  localDev?: boolean | undefined;
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  template?: string | undefined;
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const props: CreateAsyncOptions = {
    install,
    template,
    example: undefined,
    yes,
    agentsMd,
  };
  const projectRoot = path.resolve(process.cwd(), name.filesafeName);

  await fs.mkdir(projectRoot, { recursive: true });

  // In create-expo, this coerces to `${name}@sdk-${selectedSdk}` for all known
  // expo templates (e.g. expo-desktop-template-blank-typescript@sdk-54).
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L97-L114
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/promptSdkVersion.ts#L78
  const resolvedTemplate =
    template ?? `expo-desktop-template-blank-typescript@${versions.expoMajor}.${versions.minor}`;

  await extractAndPrepareTemplateAppAsync({
    projectRoot,
    name,
    rnwVersion: versions.windows,
    npmPackage: resolvedTemplate,
  });
  console.log(`${green("◆")}  Applied templates.\n`);

  await setupDependenciesAsync(projectRoot, props);

  if (props.agentsMd) {
    generateAgentFiles(projectRoot);
  }

  try {
    await initGitRepoAsync(projectRoot);
  } catch (error) {
    debug(`Error initializing git: %O`, error);
  }
}
