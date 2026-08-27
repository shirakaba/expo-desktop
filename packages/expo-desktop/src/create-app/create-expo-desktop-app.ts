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
import { selectTemplateVersion } from "./template-versions.ts";

const debug = Debug("expo-desktop:create-app") as typeof console.log;

export async function createExpoDesktopApp({
  agentsMd,
  displayName,
  install,
  projectRoot: projectRootArg,
  rdns,
  template,
  version,
  yes,
}: {
  agentsMd: boolean;
  displayName: string | undefined;
  install: boolean;
  projectRoot: string | undefined;
  rdns: string | undefined;
  template?: string | undefined;
  version: string | undefined;
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

  // In create-expo, known Expo templates are resolved as
  // `${name}@sdk-${selectedSdk}`, (e.g. expo-template-blank-typescript@sdk-54).
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/createAsync.ts#L97-L114
  // - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/promptSdkVersion.ts#L78
  //
  // But in our case, we'll use expo-desktop-template-blank-typescript@54.81.0.
  // The major version conveys the Expo SDK, the minor version conveys the React
  // Native minor, and the patch version is for patches of the template. We'll
  // revisit this once React Native hits v1.
  const resolvedTemplate = await selectTemplateVersion({
    defaultPackageName: "expo-desktop-template-blank-typescript",
    template,
    version,
    yes,
  });

  await fs.mkdir(projectRoot, { recursive: true });

  await extractAndPrepareTemplateAppAsync({
    projectRoot,
    displayName,
    rdns,
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
