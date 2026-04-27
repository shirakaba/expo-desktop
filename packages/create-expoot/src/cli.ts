import { intro, select } from "@clack/prompts";
import cac from "cac";

const cli = cac("expoot");

// TODO: Not impressed with cac. It uses `any` types and doesn't implement
//       required args as advertised.
//
// May instead try:
// - https://github.com/kazupon/gunshi
// - https://github.com/unjs/citty
// - https://github.com/privatenumber/cleye
cli
  .command("create-app", "Create a new Expo Desktop project")
  .option("--alphanumeric <name>", "The name for the app in alphanumeric format")
  .option("--display-name <name>", "The display name for the app")
  .option("--reverse-dns <name>", "The reverse-DNS (Domain Name Specifier) for the app")
  .action(async (positionals, options) => {
    console.log("AHOY", positionals, options);
    (
      await import("./commands/add-expo-desktop-to-existing-expo-app.ts")
    ).addExpoDesktopToExistingExpoApp();
  });

const parsed = cli.parse();

console.log(JSON.stringify(parsed, null, 2));

intro("create-expoot");

const command = await select({
  message: "What would you like to do?",
  options: [
    { value: "new-expo-desktop-project", label: "Create a new Expo Desktop project" },
    {
      value: "add-expo-desktop-to-existing-expo-app",
      label: "Add Expo Desktop into an existing Expo app",
    },
    // In future:
    // - Create a new standalone Expo Desktop module
    // - Add an Expo Desktop module into an existing Expo app
    // - Run prebuild?
  ],
});

switch (command) {
  case "add-expo-desktop-to-existing-expo-app": {
    (
      await import("./commands/add-expo-desktop-to-existing-expo-app.ts")
    ).addExpoDesktopToExistingExpoApp();
    break;
  }
  case "new-expo-desktop-project": {
    (await import("./commands/new-expo-desktop-project.ts")).newExpoDesktopProject();
    break;
  }
}
