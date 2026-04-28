#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";

import packageJson from "../package.json" with { type: "json" };

const main = defineCommand({
  meta: {
    name: "expo-desktop",
    version: packageJson.version,
    description: "Best-effort desktop support for Expo",
  },
  subCommands: {
    "create-app": defineCommand({
      meta: { name: "create-app", description: "Create a new Expo Desktop project" },
      args: {
        alphanumeric: {
          type: "string",
          description: `The ${kleur.bold("filesafe name")} for the app in alphanumeric format ${grey("(Example: 'MyApp123')")}`,
          valueHint: "name",
        },
        "display-name": {
          type: "string",
          description: `The ${kleur.bold("display name")} for the app ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
          valueHint: "name",
        },
        rdns: {
          type: "string",
          description: `The ${kleur.bold("reverse DNS")} for the app ${grey("(Example: 'com.example.my-app-123')")}`,
          valueHint: "name",
        },
      },
      async run({ args }) {
        (await import("./commands/new-expo-desktop-project.ts")).newExpoDesktopProject(args);
      },
    }),
  },
});

await runMain(main);
