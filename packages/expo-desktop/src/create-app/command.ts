import chalk from "chalk";

import { createExpoDesktopApp } from "./create-expo-desktop-app.ts";

export async function newExpoDesktopProject(args: {
  "project-root": string | undefined;
  "display-name": string | undefined;
  "local-dev": boolean | undefined;
  "no-agents-md": boolean | undefined;
  "no-install": boolean | undefined;
  yes: boolean | undefined;
  rdns: string | undefined;
  template: string | undefined;
  version: string | undefined;
}) {
  console.log(
    chalk.bold(
      `🏎️  Running ${chalk.yellow("expo-desktop create-app")}. Let's create a new Expo Desktop app!`,
    ),
  );
  console.log();

  // Looking for the "packageManager" option?
  //
  // Pass the `npm_config_user_agent` env var so that it gets picked up by
  // resolvePackageManager() when called by setupDependenciesAsync().
  // packages/expo-desktop/src/common/expo/create-async-utils.ts

  // A switch for skipping the questions
  const localDev = args["local-dev"];
  if (localDev) {
    await createExpoDesktopApp({
      agentsMd: !args["no-agents-md"],
      displayName: "Your App Display Name",
      install: !args["no-install"],
      projectRoot: "YourApp456",
      rdns: "uk.co.birchlabs.your-app-456",
      template: args.template,
      version: args.version,
      yes: true,
    });
  } else {
    await createExpoDesktopApp({
      agentsMd: !args["no-agents-md"],
      displayName: args["display-name"],
      install: !args["no-install"],
      projectRoot: args["project-root"],
      rdns: args.rdns,
      template: args.template,
      version: args.version,
      yes: !!args.yes,
    });
  }
}
