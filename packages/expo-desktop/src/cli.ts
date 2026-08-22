#!/usr/bin/env node

import { type ArgsDef, defineCommand, type ParsedArgs, runMain } from "citty";
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
        "project-root": {
          type: "positional",
          required: false,
          description: `The ${kleur.bold("project root")} for the app in alphanumeric format ${grey("(Example: 'MyApp123')")}`,
        },
        "display-name": {
          type: "string",
          description: `The ${kleur.bold("display name")} for the app ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
          valueHint: "name",
        },
        yes: {
          type: "boolean",
          description: "Use the default options for creating a project",
          alias: "y",
        },
        "local-dev": {
          type: "boolean",
          description:
            "An undocumented switch for use during development to skip the questionnaire.",
          hidden: true,
        },
        "no-agents-md": {
          type: "boolean",
          description: "Skip generating AGENTS.md, CLAUDE.md, and .claude/settings.json",
        },
        "no-install": {
          type: "boolean",
          description: "Skip installing npm packages or CocoaPods",
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
        template: {
          type: "string",
          description: "Base template source (tarball, npm spec, or GitHub owner/repo#ref:subpath)",
          valueHint: "template",
        },
      },
      async run({ args }) {
        parseNoArg(args, "no-agents-md");
        parseNoArg(args, "no-install");

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
          description: `Platforms to sync: ios, android, mobile, macos, windows, desktop, or all ${dim("(Default: desktop)")}`,
          valueHint: "ios|android|mobile|macos|windows|desktop|all",
          alias: "p",
        },
        "skip-dependency-update": {
          type: "boolean",
          valueHint: "dependencies",
          description:
            "Preserves versions of listed packages in package.json (comma separated list)",
        },
      },
      async run({ args }) {
        parseNoArg(args, "no-install");

        (await import("./prebuild/command.ts")).prebuild(args);
      },
    }),
  },
});

await runMain(main);

function parseNoArg<K extends NoKeys<T>, T extends ArgsDef = ArgsDef>(
  args: ParsedArgs<T>,
  noKey: K,
) {
  const [, yesKey] = noKey.split("no-");

  // Assuming the noArg has no default value:
  //
  // When `--no-install` is passed, it parses as:
  // { install: false, "no-install": undefined }
  //
  // When `--no-install` is omitted, it parses as:
  // { install: undefined, "no-install": undefined }
  if (args[yesKey] === undefined) {
    args[yesKey as keyof typeof args] = true as any;
  }
  args[noKey] = !args[yesKey] as any;

  return noKey;
}

type NoKeys<T> = Extract<keyof T, `no-${string}`>;
