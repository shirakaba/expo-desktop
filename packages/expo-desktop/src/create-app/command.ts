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


  // TODO: Revisit the --version arg and promptForVersion(), now that we
  //       manage our own template. This is the last usage of @clack/prompts in
  //       expo-desktop.
  // const versions = await promptForVersion(args.version);
  // log.info(
  //   `Will use versions: ${green(`react-native@${versions.mobile}`)}, ${green(`react-native-macos@${versions.macos}`)}, and ${green(`react-native-windows@${versions.windows}`)}, with ${green(`Expo ${versions.expoMajor}`)}.`,
  // );

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
      versions: {
        expoMajor: 54,
        expoBlankTypeScript: "54.0.45",
        minor: 81,
        mobile: "0.81.6",
        windows: "0.81.15",
        macos: "0.81.7",
      },
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
      versions: {
        expoMajor: 54,
        expoBlankTypeScript: "54.0.45",
        minor: 81,
        mobile: "0.81.6",
        windows: "0.81.15",
        macos: "0.81.7",
      },
      yes: !!args.yes,
    });
  }
}
