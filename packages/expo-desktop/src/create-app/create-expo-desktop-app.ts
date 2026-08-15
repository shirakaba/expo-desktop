import Debug from "debug";
import { green } from "kleur/colors";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  type CreateAsyncOptions,
  setupDependenciesAsync,
} from "../common/expo/create-async-utils.ts";
import { generateAgentFiles } from "../common/expo/generate-agent-files.ts";
import { initGitRepoAsync } from "../common/expo/git.ts";
import { extractAndPrepareTemplateAppAsync } from "../common/expo/template.ts";
import {
  assertFolderEmpty,
  assertValidName,
  resolveProjectRootAsync,
} from "./resolve-project-root.ts";

const debug = Debug("expo-desktop:create-app") as typeof console.log;

export async function createExpoDesktopApp({
  agentsMd,
  displayName,
  install,
  projectRoot: projectRootArg,
  rdns,
  template,
  versions,
  yes,
}: {
  agentsMd: boolean;
  displayName: string | undefined;
  install: boolean;
  projectRoot: string | undefined;
  rdns: string | undefined;
  template?: string | undefined;
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
  yes: boolean;
}) {
  const props: CreateAsyncOptions = {
    install,
    template,
    example: undefined,
    yes,
    agentsMd,
  };

  // The basename of the projectRoot is suitable to be used as the filesafeName.
  const projectRoot = await resolveProjectRootArgAsync(
    /**
     * create-expo-app defaults this optional positional arg to an empty string:
     * @see https://github.com/expo/expo/blob/037d1aa47f15e062cc2185393f08b3c08870ed65/packages/create-expo/src/utils/args.ts#L76-L77
     */
    projectRootArg ?? "",
    { yes },
  );

  // In create-expo, this coerces to `${name}@sdk-${selectedSdk}` for all known
  // expo templates (e.g. expo-desktop-template-blank-typescript@sdk-54).
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L97-L114
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/promptSdkVersion.ts#L78
  const resolvedTemplate =
    template ?? `expo-desktop-template-blank-typescript@${versions.expoMajor}.${versions.minor}`;

  await fs.mkdir(projectRoot, { recursive: true });

  await extractAndPrepareTemplateAppAsync({
    projectRoot,
    displayName,
    rdns,
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

async function resolveProjectRootArgAsync(
  inputPath: string,
  { yes }: { yes: boolean },
): Promise<string> {
  if (!inputPath && yes) {
    const projectRoot = path.resolve(process.cwd());
    const folderName = path.basename(projectRoot);
    assertValidName(folderName);
    assertFolderEmpty(projectRoot, folderName);
    return projectRoot;
  } else {
    return await resolveProjectRootAsync(inputPath);
  }
}
