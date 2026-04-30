import { confirm, isCancel, text, log } from "@clack/prompts";
import { default as kleur } from "kleur";
import { green, grey } from "kleur/colors";

import { previewFileTree } from "./preview-file-tree.ts";
import { promptForVersion } from "./prompt-for-version.ts";

export async function newExpoDesktopProject(args: {
  "filesafe-name": string | undefined;
  "display-name": string | undefined;
  rdns: string | undefined;
  version: string | undefined;
}) {
  log.info(
    `🏎️  Running ${kleur.yellow("expo-desktop create-app")}. Let's create a new Expo Desktop app!`,
    { withGuide: false },
  );

  const versions = await promptForVersion(args.version);
  log.info(
    `Will use versions: ${green(`react-native@${versions.mobile}`)}, ${green(`react-native-macos@${versions.macos}`)}, and ${green(`react-native-windows@${versions.windows}`)}.`,
  );

  title("Configuring app name");

  const { filesafeName, displayName, rdns } = await configureAppName(args);

  // TODO: ask which package manager to use to install deps
}

function title(text: string) {
  log.info(kleur.bold(kleur.inverse(`  ${text}  `)), { withGuide: false });
}

type Arg = string | symbol | undefined;

async function configureAppName(args: {
  "filesafe-name": string | undefined;
  initialFilesafeName?: string;
  "display-name": string | undefined;
  initialDisplayName?: string;
  rdns: string | undefined;
  initialRdns?: string;
}) {
  const { initialFilesafeName, initialDisplayName, initialRdns } = args;

  let filesafeName: Arg = args["filesafe-name"];
  if (!filesafeName) {
    filesafeName = await text({
      message: `Please provide the ${kleur.bold("filesafe name")} for the app in ${kleur.bold("alphanumeric")} format. ${grey("(Example: 'MyApp123')")}`,
      placeholder: initialFilesafeName ?? "MyApp",
      initialValue: initialFilesafeName ?? "MyApp",
      validate(value) {
        if (!value?.length) {
          return "Must be at least one character long.";
        }
      },
    });
  }
  if (isCancel(filesafeName)) {
    process.exit(0);
  }

  let displayName: Arg = args["display-name"];
  if (!displayName) {
    displayName = await text({
      message: `Please provide the ${kleur.bold("display name")} for the app. ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
      placeholder: initialDisplayName ?? "My App",
      initialValue: initialDisplayName ?? "My App",
      validate(value) {
        if (!value?.length) {
          return "Must be at least one character long.";
        }
      },
    });
  }
  if (isCancel(displayName)) {
    process.exit(0);
  }

  let rdns: Arg = args.rdns;
  if (!rdns) {
    rdns = await text({
      message: `Please provide the ${kleur.bold("reverse DNS")} for the app. ${grey("(Example: 'com.example.my-app-123')")}`,
      placeholder: initialRdns ?? "com.example.my-app",
      initialValue: initialRdns ?? "com.example.my-app",
      validate(value) {
        if (!value?.length) {
          return "Must be at least one character long.";
        }
      },
    });
  }
  if (isCancel(rdns)) {
    process.exit(0);
  }

  const structureIsOkay = await confirm({
    message: `Will create an Expo app with the following structure. Does this look okay?\n\n${previewFileTree({ filesafeName, rdns })}\n`,
    initialValue: true,
  });
  if (isCancel(structureIsOkay)) {
    process.exit(0);
  }
  if (!structureIsOkay) {
    return await configureAppName({
      "filesafe-name": undefined,
      initialFilesafeName: filesafeName,
      "display-name": undefined,
      initialDisplayName: displayName,
      rdns: undefined,
      initialRdns: rdns,
    });
  }

  return {
    filesafeName,
    displayName,
    rdns,
  };
}
