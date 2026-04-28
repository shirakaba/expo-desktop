import { isCancel, text, log } from "@clack/prompts";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";
import { inspect } from "node:util";

import {
  filterVersions,
  getHighestStableMinors,
  getPackageInfo,
  type NpmResponseType,
} from "../npm.ts";

export async function newExpoDesktopProject(args: {
  alphanumeric: string | undefined;
  "display-name": string | undefined;
  rdns: string | undefined;
  version: string | undefined;
}) {
  log.info(
    `🏎️  Running ${kleur.yellow("expo-desktop create-app")}. Let's create a new Expo Desktop app in a subfolder!`,
    { withGuide: false },
  );

  log.info(kleur.bold(kleur.inverse("  Configuring app name  ")), { withGuide: false });

  let version: Arg = args.version;
  if (!version) {
    try {
      const { commonMinors, highestCommonMinor, windows, macos } = await getHighestCommonMinor();
      console.log(`getHighestCommonMinor()`, { commonMinors, highestCommonMinor, windows, macos });

      if (highestCommonMinor) {
        const windowsVersion = windows[highestCommonMinor];
        const macosVersion = macos[highestCommonMinor];
      } else {
        // TODO: support installing non-common versions?
      }
    } catch (error) {
      // TODO: Get user to manually select.
    }
  }

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

async function getHighestCommonMinor() {
  let infos: [macos: NpmResponseType, windows: NpmResponseType];
  try {
    infos = await Promise.all([
      getPackageInfo("react-native-macos"),
      getPackageInfo("react-native-windows"),
    ]);
  } catch (cause) {
    throw new Error(
      "Error fetching package info for react-native-macos and/or react-native-windows from npm",
      { cause },
    );
  }

  const [macos, windows] = infos;

  // 0.80 is the first version from which New Architecture is set as default,
  // for both react-native-macos and react-native-windows.
  // https://github.com/microsoft/react-native-macos/pull/2688
  // https://microsoft.github.io/react-native-windows/docs/new-architecture
  const fromMinor = 80;
  const major = 0;

  const macosVersions = filterVersions({
    npmInfo: macos,
    fromMinor,
    includePrereleases: false,
  });
  const macosMinorsMap = getHighestStableMinors(macosVersions.map);
  const macosMinorsForMajor = macosMinorsMap[major] ?? {};

  const windowsVersions = filterVersions({
    npmInfo: windows,
    fromMinor,
    includePrereleases: false,
  });
  const windowsMinorsMap = getHighestStableMinors(windowsVersions.map);
  const windowsMinorsForMajor = windowsMinorsMap[major] ?? {};

  const commonMinors = new Set(Object.keys(macosMinorsForMajor)).intersection(
    new Set(Object.keys(windowsMinorsForMajor)),
  );
  const highestCommonMinor = [...commonMinors]
    .map(parseInt)
    .sort((a, b) => b - a)
    .at(0);

  // console.log(inspect(macosVersions, { depth: null }));
  console.log(inspect(getHighestStableMinors(macosVersions.map), { depth: null }));

  // console.log(inspect(windowsVersions, { depth: null }));
  console.log(inspect(getHighestStableMinors(windowsVersions.map), { depth: null }));

  console.log(commonMinors);
  console.log(highestCommonMinor);

  return {
    windows: windowsMinorsForMajor,
    macos: macosMinorsForMajor,
    highestCommonMinor,
    commonMinors,
  };
}
