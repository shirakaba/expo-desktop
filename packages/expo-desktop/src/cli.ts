#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { default as kleur } from "kleur";
import { dim, grey } from "kleur/colors";

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
        "filesafe-name": {
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
        version: {
          type: "string",
          description: `The ${kleur.bold("minor version")} of React Native to align on ${grey("(Examples: '0.80', 'latest')")}`,
          valueHint: "version",
        },
      },
      async run({ args }) {
        (await import("./create-app/command.ts")).newExpoDesktopProject(args);
      },
    }),
    prebuild: defineCommand({
      meta: { name: "prebuild", description: "Prebuild an Expo Desktop project" },
      args: {
        clean: {
          type: "boolean",
          description: "Delete the native folders and regenerate them before applying changes",
        },
        "no-install": {
          type: "boolean",
          description: "Skip installing npm packages and CocoaPods",
        },
        npm: {
          type: "boolean",
          description: `Use npm to install dependencies. ${dim("(Default when package-lock.json exists)")}`,
        },
        yarn: {
          type: "boolean",
          description: `Use yarn to install dependencies. ${dim("(Default when yarn.lock exists)")}`,
        },
        bun: {
          type: "boolean",
          description: `Use bun to install dependencies. ${dim("(Default when bun.lock exists)")}`,
        },
        pnpm: {
          type: "boolean",
          description: `Use pnpm to install dependencies. ${dim("(Default when pnpm-lock.yaml exists)")}`,
        },
        template: {
          type: "string",
          description:
            "Project template to clone from. File path pointing to a local tar file, npm package or a github repo",
          valueHint: "template",
        },
        platform: {
          type: "string",
          description: `Platforms to sync: macos, windows, desktop ${dim("(Default: desktop)")}`,
          valueHint: "desktop|macos|windows",
          alias: "p",
        },
      },
      async run({ args }) {
        (await import("./prebuild/command.ts")).prebuild(args);
      },
    }),
  },
});

await runMain(main);
