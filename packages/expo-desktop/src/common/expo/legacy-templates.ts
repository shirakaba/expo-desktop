import chalk from "chalk";
import prompts from "prompts";

import { env } from "./env.ts";

export const LEGACY_TEMPLATES = [
  {
    title: "Blank (TypeScript)",
    value: "expo-desktop-template-blank-typescript",
    description: "blank app with TypeScript enabled",
  },
  {
    title: "Blank (Bare)",
    value: "expo-desktop-template-bare-minimum",
    description: "blank app with the native code exposed (expo prebuild)",
  },
];

export const ALIASES = LEGACY_TEMPLATES.map(({ value }) => value);

export async function promptTemplateAsync() {
  if (env.CI) {
    throw new Error("Cannot prompt for template in CI");
  }

  const { answer } = await prompts({
    type: "select",
    name: "answer",
    message: "Choose a template:",
    choices: LEGACY_TEMPLATES,
  });

  if (!answer) {
    console.log();
    console.log(
      chalk`Specify the template name, example: {cyan --template expo-desktop-template-blank-typescript}`,
    );
    console.log();
    process.exit(1);
  }

  return answer;
}
