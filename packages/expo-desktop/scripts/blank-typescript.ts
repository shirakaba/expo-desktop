// A crude script to work out which Expo blank-typescript templates support
// which versions of React Native.

import { compareVersions } from "compare-versions";
import fs from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

import { filterVersions, getPackageInfo } from "../src/npm.ts";

// I do some manual work with this console log to populate
// blank-typescripts/package.json.
//
// const npmInfo = await getPackageInfo("expo-template-blank-typescript");
// const filtered = filterVersions({ npmInfo, fromMajor: 53 });
// console.log(inspect(filtered, { depth: null }));

const semverMatcher =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*))*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;

await getVersions();

async function getVersions() {
  const nodeModulesPath = path.resolve(import.meta.dirname, "./blank-typescripts/node_modules");
  const nodeModules = await fs.readdir(nodeModulesPath);

  const promises = new Array<
    Promise<{
      "expo-template-blank-typescript": string;
      expo: string;
      "react-native": string;
      react: string;
    }>
  >();

  for (const nodeModule of nodeModules) {
    if (!nodeModule.startsWith("v")) {
      continue;
    }

    const version = nodeModule.slice("v".length);
    const match = semverMatcher.exec(version);
    if (!match) {
      continue;
    }
    const [fullVersion, major, minor, patch] = match;

    promises.push(
      fs
        .readFile(path.resolve(nodeModulesPath, nodeModule, "package.json"), "utf-8")
        .then((packageJson) => {
          const parsed = JSON.parse(packageJson);
          const { dependencies } = parsed;

          return {
            "expo-template-blank-typescript": fullVersion,
            expo: dependencies.expo,
            "react-native": dependencies["react-native"],
            react: dependencies.react,
          };
        }),
    );
  }

  const results = await Promise.all(promises);

  const printout = new Array<
    [
      { fullVersion: string; major: number; minor: number; patch: number; prerelease: string },
      expo: string,
      reactNative: string,
      react: string,
    ]
  >();
  for (const {
    "expo-template-blank-typescript": blankTypeScript,
    expo,
    "react-native": reactNative,
    react,
  } of results) {
    const match = semverMatcher.exec(blankTypeScript);
    if (!match) {
      continue;
    }
    const [fullVersion, major, minor, patch, prerelease] = match;

    printout.push([
      {
        fullVersion,
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch),
        prerelease,
      },
      expo,
      reactNative,
      react,
    ]);
  }

  const sorted = printout.sort((a, b) => compareVersions(a[0].fullVersion, b[0].fullVersion));

  const reduced = sorted.reduce((acc, val) => {
    acc.push([val[0].fullVersion, val[1], val[2], val[3]]);
    return acc;
  }, new Array<[blankTypeScript: string, expo: string, reactNative: string, react: string]>());

  await fs.writeFile(
    path.resolve(import.meta.dirname, "blank-typescripts/blank-typescript-versions.txt"),
    [
      "template | expo            | react-native | react",
      reduced.map((row) => row.join(" | ")).join("\n"),
    ].join("\n"),
    "utf-8",
  );
}
