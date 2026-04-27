import { type } from "arktype";

export const SemverMajorMinorOnly = type("/^(\\d+)\\.(\\d+)$/");
export const Dns = type("/^[a-zA-Z][a-zA-Z0-9]*(?:\\.[a-zA-Z][a-zA-Z0-9]*)*$/");
export const UnderscoredDns = type("/^[a-zA-Z]\\w*(?:\\.[a-zA-Z]\\w*)*$/");
export const HyphenatedDns = type("/^[a-zA-Z][a-zA-Z0-9\\-]*(?:\\.[a-zA-Z][a-zA-Z0-9\\-]*)*$/");
export const UnderscoredOrHyphenatedDns = type("/^[a-zA-Z][\\w\\-]*(?:\\.[a-zA-Z][\\w\\-]*)*$/");

const description = {
  reactNativeVersion:
    "The `{major}.{minor}` version of `react-native` to align to, e.g. '0.82'. Defaults to the highest mutually supported across both `react-native-macos` and `react-native-windows`.",
  name: {
    itself: "Different formats of the app name for use in different contexts.",
    alphanumeric:
      "A **filesafe name** for the app consisting only of alphanumeric characters (A-z, and 0-9), e.g. 'MyApp123'. Will be used mainly for file names, e.g. 'MyApp123.xcodeproj'.",
    displayName:
      "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Will be used as the app name on the iOS/Android home screen, in macOS Finder, and in Windows Explorer.",
    reverseDns:
      "The **reverse-Domain Name Specifier** for your app, e.g. 'com.example.my-app-123'. Accepts alphanumeric characters (A-z and 0-9), hyphens, and underscores. Will be used to fill in `android.package_namespace`, `android.application_id`, `windows.namespace`, `ios.bundle_identifier`, and `macos.bundle_identifier`. Hyphens and underscores will be sanitised as appropriate for these destinations, so don't worry which you use here.",
  },
  android: {
    itself: "Android-specific overrides for the default values (which are based on `name`).",
    applicationId:
      "The **application ID** used on the Play Store, e.g. 'com.example.my_app_123'. Accepts only alphanumeric characters (A-z and 0-9), and underscores. Corresponds to `android.defaultConfig.applicationId` in `app/build.gradle`. Recommended to match `android.package_namespace`.",
    packageNamespace:
      "The **package namespace**, e.g. 'com.example.my_app_123'. Accepts only alphanumeric characters (A-z and 0-9), and underscores. Corresponds to `android.namespace` in `app/build.gradle`. Recommended to match `android.application_id`.",
    rootProjectName:
      "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to `rootProject.name` in `settings.gradle`. Will be used as the app name on the Android home screen.",
  },
  ios: {
    itself: "iOS-specific overrides for the default values (which are based on `name`).",
    bundleDisplayName:
      "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `CFBundleDisplayName` key in the `Info.plist` file. Will be used as the app name on the iOS home screen.",
    bundleIdentifier:
      "The **bundle identifier** of your app, e.g. 'com.example.my-app-123'. Accepts only alphanumeric characters (A-z and 0-9), and hyphens. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleIdentifier` key in the `Info.plist` file.",
  },
  macos: {
    itself: "macOS-specific overrides for the default values (which are based on `name`).",
    bundleDisplayName:
      "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleDisplayName` key in the `Info.plist` file. Will be used as the app name in macOS Finder.",
    bundleIdentifier:
      "The **bundle identifier** of your app, e.g. 'com.example.my-app-123'. Accepts only alphanumeric characters (A-z and 0-9), and hyphens. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleIdentifier` key in the `Info.plist` file.",
  },
  windows: {
    itself: "Windows-specific overrides for the default values (which are based on `name`).",
    displayName:
      "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `ProjectName` value in the `.vcxproj` file. Will be used as the app name in Windows Explorer.",
    namespace:
      "The WinRT and C++ **namespace**, e.g. 'com.example.myapp123'. Accepts only alphanumeric characters (A-z and 0-9). When used in C++, `.` characters are converted to `::`, e.g. 'com::example::myapp123'.",
    projectName:
      "A **filesafe name** for the app consisting only of alphanumeric characters (A-z, and 0-9), e.g. 'MyApp123'. Will be used mainly for file names, e.g. 'MyApp123.vcxproj'.",
  },
} as const;

function definePartialAppConfig({ includeDescriptions }: { includeDescriptions: boolean }) {
  const describe = <Schema extends { describe: (description: string) => unknown }>(
    schema: Schema,
    text: string,
  ): Schema => (includeDescriptions ? (schema.describe(text) as Schema) : schema);

  // Keep this in sync with AppConfig below.
  return type({
    "react_native_version?": describe(SemverMajorMinorOnly, description.reactNativeVersion),
    name: describe(
      type({
        alphanumeric: describe(type("string.alphanumeric"), description.name.alphanumeric),
        display_name: describe(type("string"), description.name.displayName),
        reverse_dns: describe(UnderscoredOrHyphenatedDns, description.name.reverseDns),
      }),
      description.name.itself,
    ),
    ["android?"]: describe(
      type({
        "application_id?": describe(UnderscoredDns, description.android.applicationId),
        "package_namespace?": describe(UnderscoredDns, description.android.packageNamespace),
        "root_project_name?": describe(type("string"), description.android.rootProjectName),
      }),
      description.android.itself,
    ),
    ["ios?"]: describe(
      type({
        "bundle_display_name?": describe(type("string"), description.ios.bundleDisplayName),
        "bundle_identifier?": describe(HyphenatedDns, description.ios.bundleIdentifier),
      }),
      description.ios.itself,
    ),
    ["macos?"]: describe(
      type({
        "bundle_display_name?": describe(type("string"), description.macos.bundleDisplayName),
        "bundle_identifier?": describe(HyphenatedDns, description.macos.bundleIdentifier),
      }),
      description.macos.itself,
    ),
    ["windows?"]: describe(
      type({
        "display_name?": describe(type("string"), description.windows.displayName),
        "namespace?": describe(Dns, description.windows.namespace),
        "project_name?": describe(type("string.alphanumeric"), description.windows.projectName),
      }),
      description.windows.itself,
    ),
  });
}

export const PartialAppConfig = definePartialAppConfig({
  includeDescriptions: false,
});

export const PartialAppConfigForJsonSchema = definePartialAppConfig({
  includeDescriptions: true,
});

// Keep this in sync with PartialAppConfig above.
export const AppConfig = type({
  react_native_version: SemverMajorMinorOnly,
  name: {
    alphanumeric: "string.alphanumeric",
    display_name: "string",
    reverse_dns: UnderscoredOrHyphenatedDns,
  },
  android: {
    application_id: UnderscoredDns,
    package_namespace: UnderscoredDns,
    root_project_name: "string",
  },
  ios: {
    bundle_display_name: "string",
    bundle_identifier: HyphenatedDns,
  },
  macos: {
    bundle_display_name: "string",
    bundle_identifier: HyphenatedDns,
  },
  windows: {
    display_name: "string",
    namespace: Dns,
    project_name: "string.alphanumeric",
  },
});
