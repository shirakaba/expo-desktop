import { isCancel, select, tasks, text, log, type Option } from "@clack/prompts";
import { default as kleur } from "kleur";
import { green, grey } from "kleur/colors";

import {
  filterVersions,
  getHighestStableMinors,
  getPackageInfo,
  semverMatcher,
  type NpmResponseType,
} from "../npm.ts";

export async function newExpoDesktopProject(args: {
  alphanumeric: string | undefined;
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

async function promptForVersion(desiredMinorVersion?: string) {
  let packageInfos: [mobile: NpmResponseType, macos: NpmResponseType, windows: NpmResponseType];
  try {
    await tasks([
      {
        title: "⏳ Fetching React Native version history...",
        task: async () => {
          packageInfos = await fetchReactNativePackageInfos();
          return "⌛️ Fetched React Native version history!";
        },
      },
    ]);
  } catch (cause) {
    throw new Error("Error fetching React Native version history", { cause });
  }

  const major = 0;
  const { commonMinors, highestCommonMinor, windows, macos, mobile } = await getHighestCommonMinor({
    major,
    mobile: packageInfos![0],
    macos: packageInfos![1],
    windows: packageInfos![2],
  });
  // console.log(`getHighestCommonMinor()`, { commonMinors, highestCommonMinor, windows, macos });

  if (!highestCommonMinor || !commonMinors.size) {
    throw new Error(
      "Unexpectedly found no common minor version between the React Native packages.",
    );
  }

  if (desiredMinorVersion) {
    const match = semverMatcher.exec(`${desiredMinorVersion}.0`);
    if (match) {
      const [, desiredMajor, desiredMinor] = match;
      if (parseInt(desiredMajor) === major) {
        const desiredMinorInt = parseInt(desiredMinor);
        const mobileVersion = mobile[desiredMinorInt];
        const windowsVersion = windows[desiredMinorInt];
        const macosVersion = macos[desiredMinorInt];

        if (!mobileVersion || !windowsVersion || !macosVersion) {
          throw new Error(
            `One or more react-native packages did not support the version ${desiredMajor}.${desiredMinor}. Got react-native@${mobileVersion}, react-native-windows@${windowsVersion}, and react-native-macos@${macosVersion}.`,
          );
        }

        return {
          minor: desiredMinorInt,
          mobile: mobileVersion,
          windows: windowsVersion,
          macos: macosVersion,
        };
      }

      log.info(
        `Unexpectedly got major version '${desiredMajor}'. We only support '0' for now. Falling back to manual selection.`,
      );
    } else {
      log.info(
        `Unable to parse version '${desiredMinorVersion}'. Expected major.minor only, e.g. '0.82'. Falling back to manual selection.`,
      );
    }
  }

  if (commonMinors.size === 1) {
    log.info(`Only one common minor version available, '0.${highestCommonMinor}'. Choosing that.`);
    return {
      minor: highestCommonMinor,
      mobile: mobile[highestCommonMinor],
      macos: macos[highestCommonMinor],
      windows: windows[highestCommonMinor],
    };
  }

  const options: Array<
    Option<{
      minor: number;
      mobile: string;
      macos: string;
      windows: string;
    }>
  > = [
    ...[...commonMinors].map((minor) => {
      const minorInt = parseInt(minor);

      return {
        value: {
          minor: minorInt,
          mobile: mobile[minorInt],
          macos: macos[minorInt],
          windows: windows[minorInt],
        },
        label:
          minorInt === highestCommonMinor ? `${major}.${minor} (recommended)` : `${major}.${minor}`,
      };
    }),
  ];

  const chosenVersion = await select({
    message: `Which ${kleur.bold("common version")} of ${kleur.bold("react-native")}, ${kleur.bold("react-native-macos")}, and ${kleur.bold("react-native-windows")} shall we install?`,
    options,
    initialValue: options.find(({ value }) => value.minor === highestCommonMinor)!.value,
  });
  if (isCancel(chosenVersion)) {
    process.exit(0);
  }

  return chosenVersion;
}

async function fetchReactNativePackageInfos() {
  let infos: [mobile: NpmResponseType, macos: NpmResponseType, windows: NpmResponseType];
  try {
    infos = await Promise.all([
      getPackageInfo("react-native"),
      getPackageInfo("react-native-macos"),
      getPackageInfo("react-native-windows"),
    ]);
  } catch (cause) {
    throw new Error("Error fetching package info for react-native package(s) from npm", { cause });
  }

  return infos;
}

async function getHighestCommonMinor({
  major,
  mobile,
  macos,
  windows,
}: {
  major: number;
  mobile: NpmResponseType;
  macos: NpmResponseType;
  windows: NpmResponseType;
}) {
  // 0.80 is the first version from which New Architecture is set as default,
  // for both react-native-macos and react-native-windows.
  // https://github.com/microsoft/react-native-macos/pull/2688
  // https://microsoft.github.io/react-native-windows/docs/new-architecture
  const fromMinor = 78;

  const mobileVersions = filterVersions({
    npmInfo: mobile,
    fromMinor,
    includePrereleases: false,
  });
  const mobileMinorsMap = getHighestStableMinors(mobileVersions.map);
  const mobileMinorsForMajor = mobileMinorsMap[major] ?? {};

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

  const commonMinors = new Set(Object.keys(mobileMinorsForMajor))
    .intersection(new Set(Object.keys(windowsMinorsForMajor)))
    .intersection(new Set(Object.keys(macosMinorsForMajor)));
  const highestCommonMinor = [...commonMinors]
    .map((minor) => parseInt(minor))
    .sort((a, b) => b - a)
    .at(0);

  // console.log(inspect(macosVersions, { depth: null }));
  // console.log(inspect(getHighestStableMinors(macosVersions.map), { depth: null }));

  // console.log(inspect(windowsVersions, { depth: null }));
  // console.log(inspect(getHighestStableMinors(windowsVersions.map), { depth: null }));

  // console.log(commonMinors);
  // console.log(highestCommonMinor);

  return {
    mobile: mobileMinorsForMajor,
    windows: windowsMinorsForMajor,
    macos: macosMinorsForMajor,
    highestCommonMinor,
    commonMinors,
  };
}
