import { isCancel, text, log } from "@clack/prompts";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";

export async function newExpoDesktopProject(args: {
  alphanumeric: string | undefined;
  "display-name": string | undefined;
  rdns: string | undefined;
}) {
  log.info(
    `🏎️  Running ${kleur.yellow("expo-desktop create-app")}. Let's create a new Expo Desktop app in a subfolder!`,
    { withGuide: false },
  );

  log.info(kleur.bold(kleur.inverse("  Configuring app name  ")), { withGuide: false });

  let alphanumeric: Arg = args.alphanumeric;
  if (!alphanumeric) {
    alphanumeric = await text({
      message: `Please provide the ${kleur.bold("filesafe name")} for the app in ${kleur.bold("alphanumeric")} format. ${grey("(Example: 'MyApp123')")}`,
      placeholder: "MyApp",
      initialValue: "MyApp",
      validate(value) {
        if (!value?.length) {
          return "Must be at least one character long.";
        }
      },
    });
  }
  if (isCancel(alphanumeric)) {
    process.exit(0);
  }

  let displayName: Arg = args["display-name"];
  if (!displayName) {
    displayName = await text({
      message: `Please provide the ${kleur.bold("display name")} for the app. ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
      placeholder: "My App",
      initialValue: "My App",
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
      placeholder: "com.example.my-app",
      initialValue: "com.example.my-app",
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
}

type Arg = string | symbol | undefined;
