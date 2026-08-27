import chalk from "chalk";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";
import fs from "node:fs";
import path from "node:path";
import prompts from "prompts";

import { getConflictsForDirectory } from "../common/expo/dir.ts";
import { Log } from "../common/expo/log.ts";
import { formatSelfCommand } from "../common/expo/resolve-package-manager.ts";
import * as Template from "../common/expo/template.ts";

export function assertValidName(folderName: string) {
  const validation = Template.validateName(folderName);
  if (typeof validation === "string") {
    Log.exit(chalk`{red Cannot create an app named {bold "${folderName}"}. ${validation}}`, 1);
  }
  const isFolderNameForbidden = Template.isFolderNameForbidden(folderName);
  if (isFolderNameForbidden) {
    Log.exit(
      chalk`{red Cannot create an app named {bold "${folderName}"} because it would conflict with a dependency of the same name.}`,
      1,
    );
  }
}

export function assertFolderEmpty(projectRoot: string, folderName: string) {
  const conflicts = getConflictsForDirectory(projectRoot);
  if (conflicts.length) {
    Log.log(chalk`The directory {cyan ${folderName}} has files that might be overwritten:`);
    Log.log();
    for (const file of conflicts) {
      Log.log(`  ${file}`);
    }
    Log.log();
    Log.exit("Try using a new directory name, or moving these files.\n");
  }
}

/**
 * Resolves the project root from the project root arg, ensuring that its
 * basename is what we consider a filesafe name.
 */
export async function resolveProjectRootAsync(input: string): Promise<string> {
  let name = input?.trim();

  if (!name) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `Please provide the ${kleur.bold("filesafe name")} for the app in ${kleur.bold("alphanumeric")} format. ${grey("(Example: 'MyApp123')")}`,
      initial: "MyApp",
      validate: (name) => {
        const validation = Template.validateName(path.basename(path.resolve(name)));
        if (typeof validation === "string") {
          return "Invalid filesafe name: " + validation;
        }
        return true;
      },
    });

    if (typeof answer === "string") {
      name = answer.trim();
    }
  }

  if (!name) {
    const selfCmd = formatSelfCommand();
    Log.log();
    Log.log("Choose a name for your app:");
    Log.log(chalk`  {dim $} {cyan ${selfCmd} <name>}`);
    Log.log();
    Log.log(`For more info, run:`);
    Log.log(chalk`  {dim $} {cyan ${selfCmd} --help}`);
    Log.log();
    Log.exit("");
  }

  const projectRoot = path.resolve(name);
  const folderName = path.basename(projectRoot);

  assertValidName(folderName);

  await fs.promises.mkdir(projectRoot, { recursive: true });

  assertFolderEmpty(projectRoot, folderName);

  return projectRoot;
}
