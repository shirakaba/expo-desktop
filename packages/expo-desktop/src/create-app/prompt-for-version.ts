import { isCancel, log, type Option, select, tasks } from "@clack/prompts";
import kleur from "kleur";

import {
  filterVersions,
  getHighestStableMinors,
  getPackageInfo,
  type NpmResponseType,
  semverMatcher,
} from "../common/npm.ts";

export async function promptForVersion(desiredMinorVersion?: string) {
  let packageInfos: [
    expo: NpmResponseType,
    mobile: NpmResponseType,
    macos: NpmResponseType,
    windows: NpmResponseType,
  ];
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
    mobile: packageInfos![1],
    macos: packageInfos![2],
    windows: packageInfos![3],
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

        const expoBlankTypeScript = getExpoBlankTypeScriptForRNVersion({
          major,
          minor: desiredMinorInt,
        });

        const expoMajor = expoBlankTypeScript?.split(".").at(0);
        log.info(
          `Only one common minor version available, '0.${desiredMinorInt}' (Expo ${expoMajor}). Choosing that.`,
        );
        if (!expoBlankTypeScript || !expoMajor) {
          throw new Error(
            `Unclear what Expo blank-typescript template version corresponds to the React Native version ${major}.${desiredMinorInt}.`,
          );
        }

        return {
          expoMajor: parseInt(expoMajor),
          expoBlankTypeScript,
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
    const expoBlankTypeScript = getExpoBlankTypeScriptForRNVersion({
      major,
      minor: highestCommonMinor,
    });

    const expoMajor = expoBlankTypeScript?.split(".").at(0);
    log.info(
      `Only one common minor version available, '0.${highestCommonMinor}' (Expo ${expoMajor}). Choosing that.`,
    );
    if (!expoBlankTypeScript || !expoMajor) {
      throw new Error(
        `Unclear what Expo blank-typescript template version corresponds to the React Native version ${major}.${highestCommonMinor}.`,
      );
    }

    return {
      expoMajor: parseInt(expoMajor),
      expoBlankTypeScript,
      minor: highestCommonMinor,
      mobile: mobile[highestCommonMinor],
      macos: macos[highestCommonMinor],
      windows: windows[highestCommonMinor],
    };
  }

  const options: Array<
    Option<{
      minor: number;
      expoBlankTypeScript: string;
      expoMajor: number;
      mobile: string;
      macos: string;
      windows: string;
    }>
  > = [
    ...[...commonMinors].map((minor) => {
      const minorInt = parseInt(minor);

      const expoBlankTypeScript = getExpoBlankTypeScriptForRNVersion({ major, minor: minorInt });
      if (!expoBlankTypeScript) {
        throw new Error(
          `Unclear what Expo blank-typescript template version corresponds to the React Native version ${major}.${minorInt}.`,
        );
      }

      const expoMajor = parseInt(expoBlankTypeScript.split(".")[0]);

      return {
        value: {
          minor: minorInt,
          expoMajor,
          expoBlankTypeScript,
          mobile: mobile[minorInt],
          macos: macos[minorInt],
          windows: windows[minorInt],
        },
        label:
          minorInt === highestCommonMinor
            ? `${major}.${minor} (Expo ${expoMajor}; recommended)`
            : `${major}.${minor} (Expo ${expoMajor})`,
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

export const blankTypeScriptMap: {
  [reactNativeMajor: number]: {
    [reactNativeMinor: number]: {
      /**
       * The version number of expo-template-blank-typescript.
       */
      [reactNativePatch: number]: string;
    };
  };
} = {
  0: {
    79: {
      // expo@~53.0.0-preview.7
      0: "53.0.11",

      // expo@~53.0.4
      1: "53.0.20",

      // expo@~53.0.9
      2: "53.0.28",

      // expo@~53.0.11
      3: "53.0.32",

      // expo@~53.0.15
      4: "53.0.35",

      // expo@~53.0.20
      5: "53.0.38",

      // expo@~53.0.27
      6: "53.0.42",
    },
    80: {
      // React Native 0.80 is supported in the Expo SDK 54 canary. So let's just
      // point at the latest blank-typescript template from SDK 54.
      // https://expo.dev/changelog/react-native-80

      // expo@~54.0.34
      0: "54.0.45",
      1: "54.0.45",
      2: "54.0.45",
      3: "54.0.45",
    },
    81: {
      // expo@~54.0.0-preview.8
      0: "54.0.9",

      // expo@~54.0.0-preview.15
      1: "54.0.14",

      // expo@~54.0.17
      4: "54.0.29",

      // expo@~54.0.34
      5: "54.0.45",
    },
    82: {
      // React Native 0.82 is supported in the Expo SDK 55 canary. So let's just
      // point at the latest blank-typescript template from SDK 55.
      // https://reactnative.dev/blog/2025/10/08/react-native-0.82

      // expo@~55.0.18
      0: "55.1.25",
      1: "55.1.25",
    },
    83: {
      // expo@~55.0.0-preview.10
      1: "55.1.4",

      // expo@~55.0.8
      2: "55.1.15",

      // expo@~55.0.15
      4: "55.1.22",

      // expo@~55.0.18
      6: "55.1.25",
    },
  },
};

const expoMap = {
  0: {
    // react-native@0.80.0 and 0.80.1 were both referenced in
    // bare-minimum@53.0.31 (expo@~53.0.11) but these commits were never
    // published to npm, so bare-minimum@53.0.31 still gives
    // react-native@0.79.3:
    // - 0.80.0: https://github.com/expo/expo/blob/338ef55c67074ffbf8b105ab8860e33cbb99317c/templates/expo-template-bare-minimum/package.json
    // - 0.80.1: https://github.com/expo/expo/blob/e1cb6c541ae0b077c415401f814e054d612100ad/templates/expo-template-bare-minimum/package.json
    80: 53,

    // react-native@0.81.0 was supported on expo@~53.0.11:
    // - 0.81.0: https://github.com/expo/expo/blob/61e0a6c26e7ee330fb93cf89ef92c8d7ab78488a/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.81.1 was supported from expo@~54.0.0-preview.9:
    // - 0.81.1: https://github.com/expo/expo/blob/9f4a463bd103c583c54aeba9e961af58e2a24949/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.81.3 and react-native@0.81.4 were supported from
    // expo@~54.0.0-preview.16:
    // - 0.81.3: https://github.com/expo/expo/blob/9f4a463bd103c583c54aeba9e961af58e2a24949/templates/expo-template-bare-minimum/package.json
    // - 0.81.4: https://github.com/expo/expo/blob/06bbeea8d35fb86e059afaaf9db11079313569b0/templates/expo-template-bare-minimum/package.json
    81: 54,

    // react-native@0.82.1 was supported from expo@~54.0.8
    // (bare-minimum@54.0.25):
    // - 0.82.1: https://github.com/expo/expo/blob/7ae5b031363fc01c36a3f779f2ae2cd0baa6d9d1/templates/expo-template-bare-minimum/package.json
    82: 55,

    // react-native@0.83.0 was supported from expo@~54.0.8:
    // - 0.83.0: https://github.com/expo/expo/blob/90aff2d6722fc7995de8c12568df0fdb77a46dbd/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.83.1 was supported from expo@~54.0.8:
    // - 0.83.1: https://github.com/expo/expo/blob/64800c9614beabb385669634c6911a8491742d9b/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.83.2 was supported from expo@~55.0.0-preview.10:
    // - 0.83.2: https://github.com/expo/expo/blob/c538599451b0a477bd3af0a4a01dbfc786163086/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.83.4 was supported from expo@~55.0.8:
    // - 0.83.4: https://github.com/expo/expo/blob/f4772b2a0ed210e4217bf3f13fdb14e945e0d52f/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.83.5 and react-native@0.83.6 were supported from
    // expo@~55.0.15:
    // - 0.83.5: https://github.com/expo/expo/blob/7b9952145cdeb3414f2faf57d8fb68fe5e5848e7/templates/expo-template-bare-minimum/package.json
    // - 0.83.6: https://github.com/expo/expo/blob/f8fa69f3966dc911cb12332a38b5964fc3098bce/templates/expo-template-bare-minimum/package.json
    83: 55,

    // react-native@0.85.0 was supported from expo@~55.0.2:
    // - 0.84.0: https://github.com/expo/expo/blob/9a58e0fd41153b58a13f6835a410c268403b55f2/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.85.1 was supported from expo@~55.0.2:
    // - 0.84.1: https://github.com/expo/expo/blob/9e1c555da77b2300172f66d13bbe382f8f5e1ef8/templates/expo-template-bare-minimum/package.json
    84: 55,

    // This is the current WIP on the sdk-56 branch, so I expect we'll
    // eventually see Expo 56 become the blessed release for react-native@0.85.
    //
    // react-native@0.85.0 was supported from expo@~55.0.2:
    // - 0.85.0: https://github.com/expo/expo/blob/096f4cb59ef39043b1f7e7aa8b7041e5a78a2a8e/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.85.1 was supported from expo@~55.0.2:
    // - 0.85.1: https://github.com/expo/expo/blob/13940994f0fb1833f1a03bba8f406b766089298e/templates/expo-template-bare-minimum/package.json
    //
    // react-native@0.85.2 was supported from expo@~55.0.2:
    // - 0.85.2: https://github.com/expo/expo/blob/53cd895d4b6d889b703f8544690d649a09284449/templates/expo-template-bare-minimum/package.json
    85: 55,
  },
} as const satisfies ExpoSupportMap;
type ExpoSupportMap = { [reactNativeMajor: number]: { [reactNativeMinor: number]: number } };

// Expo SDK 53 is the lowest version to support React Native 0.80.0, which is
// the version (on desktop) that sets New Architecture as on by default.
const expoFirstNewArchMajor = 53;

export async function fetchReactNativePackageInfos() {
  let infos: [
    expo: NpmResponseType,
    mobile: NpmResponseType,
    macos: NpmResponseType,
    windows: NpmResponseType,
  ];
  try {
    infos = await Promise.all([
      getPackageInfo("expo"),
      getPackageInfo("react-native"),
      getPackageInfo("react-native-macos"),
      getPackageInfo("react-native-windows"),
    ]);
  } catch (cause) {
    throw new Error("Error fetching package info for react-native package(s) from npm", { cause });
  }

  return infos;
}

export async function getHighestCommonMinor({
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
  const fromMinor = 80;

  const mobileVersions = filterVersions({ npmInfo: mobile, fromMinor });
  const mobileMinorsMap = getHighestStableMinors(mobileVersions.map);
  const mobileMinorsForMajor = mobileMinorsMap[major] ?? {};

  const macosVersions = filterVersions({ npmInfo: macos, fromMinor });
  const macosMinorsMap = getHighestStableMinors(macosVersions.map);
  const macosMinorsForMajor = macosMinorsMap[major] ?? {};

  const windowsVersions = filterVersions({ npmInfo: windows, fromMinor });
  const windowsMinorsMap = getHighestStableMinors(windowsVersions.map);
  const windowsMinorsForMajor = windowsMinorsMap[major] ?? {};

  const commonMinors = new Set(Object.keys(mobileMinorsForMajor))
    .intersection(new Set(Object.keys(windowsMinorsForMajor)))
    .intersection(new Set(Object.keys(macosMinorsForMajor)));
  const highestCommonMinor = [...commonMinors]
    .map((minor) => parseInt(minor))
    .sort((a, b) => b - a)
    .at(0);

  return {
    mobile: mobileMinorsForMajor,
    windows: windowsMinorsForMajor,
    macos: macosMinorsForMajor,
    highestCommonMinor,
    commonMinors,
  };
}

export function getHighestPatch({
  fromMajor,
  major,
  npmInfo,
}: {
  fromMajor?: number;
  major: number;
  npmInfo: NpmResponseType;
}) {
  const versions = filterVersions({ npmInfo, fromMajor: fromMajor! });
  const majorsToMinors = getHighestStableMinors(versions.map);
  const minorsToHighestPatches = majorsToMinors[major];
  if (typeof minorsToHighestPatches === "undefined") {
    return;
  }

  const highestMinor = Object.keys(minorsToHighestPatches)
    .map((key) => parseInt(key))
    .sort((a, b) => b - a)
    .at(0);
  if (typeof highestMinor === "undefined") {
    return;
  }

  return minorsToHighestPatches[highestMinor];
}

function getExpoForRNVersion({
  npmInfo,
  major,
  minor,
}: {
  npmInfo: NpmResponseType;
  major: number;
  minor: number;
}) {
  const rnMinorsToExpoMajors = expoMap[major as keyof typeof expoMap];
  if (!rnMinorsToExpoMajors) {
    return;
  }
  const expo = getHighestPatch({
    fromMajor: expoFirstNewArchMajor,
    major: rnMinorsToExpoMajors[minor as keyof typeof rnMinorsToExpoMajors],
    npmInfo,
  });
  if (!expo) {
    return;
  }

  return expo;
}

function getExpoBlankTypeScriptForRNVersion({ major, minor }: { major: number; minor: number }) {
  const patches = blankTypeScriptMap[major][minor];
  if (!patches) {
    return;
  }

  const highestPatch = Object.keys(patches)
    .map((patch) => parseInt(patch))
    .sort((a, b) => b - a)
    .at(0);

  if (typeof highestPatch !== "number") {
    return;
  }

  return patches[highestPatch];
}
