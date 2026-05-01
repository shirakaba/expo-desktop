import { type } from "arktype";

export const ExpoConfig = type({
  "name?": "string",
  "slug?": "string",
  "version?": "string",
  "ios?": type({
    "bundleIdentifier?": "string",

    // Set the display name using the withDisplayName() Config Plugin:
    // https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/ios/Name.ts#L14
  }),
  "android?": type({
    "package?": "string",

    // Set the display name using the withNameSettingsGradle() Config Plugin:
    // https://github.com/expo/expo/blob/e6f247b4f2b0d1dffb819d4821bc2b0a8393c80e/packages/%40expo/config-plugins/src/android/Name.ts#L28
  }),
  "plugins?": type(type(["string", "...", "unknown[]"]).or("string")).array(),
});

export const ExpoDesktopConfig = type({
  displayName: "string",
  filesafeName: "string",
  rdns: "string",
  "macos?": type({
    "bundleIdentifier?": "string",
  }),
  "windows?": type({
    // "projectName?": "string",
    "displayName?": "string",
    // "namespace?": "string",
  }),
});

export const AppJson = type({
  "expo?": ExpoConfig,
});

export const EnhancedAppJson = type({
  "expo?": ExpoConfig,
  "expo-desktop?": ExpoDesktopConfig,
});

export const PackageJson = type({
  "name?": "string",
  "scripts?": "Record<string, string>",
  "dependencies?": "Record<string, string>",
  "devDependencies?": "Record<string, string>",
  "peerDependencies?": "Record<string, string>",
});
