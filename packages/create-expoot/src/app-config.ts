import { type } from "arktype";

export const SemverMajorMinorOnly = type("/^(\\d+)\\.(\\d+)$/");
export const Dns = type("/^[a-zA-Z][a-zA-Z0-9]*(?:\\.[a-zA-Z][a-zA-Z0-9]*)*$/");
export const UnderscoredDns = type("/^[a-zA-Z]\\w*(?:\\.[a-zA-Z]\\w*)*$/");
export const HyphenatedDns = type("/^[a-zA-Z][a-zA-Z0-9\\-]*(?:\\.[a-zA-Z][a-zA-Z0-9\\-]*)*$/");
export const UnderscoredOrHyphenatedDns = type("/^[a-zA-Z][\\w\\-]*(?:\\.[a-zA-Z][\\w\\-]*)*$/");

function defineAppConfig({ includeDescriptions }: { includeDescriptions: boolean }) {
  const description = (text: string) => (includeDescriptions ? { description: text } : {});

  return type({
    ["react_native_version?"]: SemverMajorMinorOnly.configure(
      description(
        "The `{major}.{minor}` version of `react-native` to align to, e.g. '0.82'. Defaults to the highest mutually supported across both `react-native-macos` and `react-native-windows`.",
      ),
    ),
    name: type({
      alphanumeric: type("string.alphanumeric").configure(
        description(
          "A **filesafe name** for the app consisting only of alphanumeric characters (A-z, and 0-9), e.g. 'MyApp123'. Will be used mainly for file names, e.g. 'MyApp123.xcodeproj'.",
        ),
      ),
      display_name: type("string").configure(
        description(
          "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Will be used as the app name on the iOS/Android home screen, in macOS Finder, and in Windows Explorer.",
        ),
      ),
      reverse_dns: UnderscoredOrHyphenatedDns.configure(
        description(
          "The **reverse-Domain Name Specifier** for your app, e.g. 'com.example.my-app-123'. Accepts alphanumeric characters (A-z and 0-9), hyphens, and underscores. Will be used to fill in `android.package_namespace`, `android.application_id`, `windows.namespace`, `ios.bundle_identifier`, and `macos.bundle_identifier`. Hyphens and underscores will be sanitised as appropriate for these destinations, so don't worry which you use here.",
        ),
      ),
    }).configure(description("Different formats of the app name for use in different contexts.")),
    ["android?"]: type({
      ["application_id?"]: UnderscoredDns.configure(
        description(
          "The **application ID** used on the Play Store, e.g. 'com.example.my_app_123'. Accepts only alphanumeric characters (A-z and 0-9), and underscores. Corresponds to `android.defaultConfig.applicationId` in `app/build.gradle`. Recommended to match `android.package_namespace`.",
        ),
      ),
      ["package_namespace?"]: UnderscoredDns.configure(
        description(
          "The **package namespace**, e.g. 'com.example.my_app_123'. Accepts only alphanumeric characters (A-z and 0-9), and underscores. Corresponds to `android.namespace` in `app/build.gradle`. Recommended to match `android.application_id`.",
        ),
      ),
      ["root_project_name?"]: type("string").configure(
        description(
          "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to `rootProject.name` in `settings.gradle`. Will be used as the app name on the Android home screen.",
        ),
      ),
    }).configure(
      description("Android-specific overrides for the default values (which are based on `name`)."),
    ),
    ["ios?"]: type({
      ["bundle_display_name?"]: type("string").configure(
        description(
          "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `CFBundleDisplayName` key in the `Info.plist` file. Will be used as the app name on the iOS home screen.",
        ),
      ),
      ["bundle_identifier?"]: HyphenatedDns.configure(
        description(
          "The **bundle identifier** of your app, e.g. 'com.example.my-app-123'. Accepts only alphanumeric characters (A-z and 0-9), and hyphens. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleIdentifier` key in the `Info.plist` file.",
        ),
      ),
    }).configure(
      description("iOS-specific overrides for the default values (which are based on `name`)."),
    ),
    ["macos?"]: type({
      ["bundle_display_name?"]: type("string").configure(
        description(
          "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleDisplayName` key in the `Info.plist` file. Will be used as the app name in macOS Finder.",
        ),
      ),
      ["bundle_identifier?"]: HyphenatedDns.configure(
        description(
          "The **bundle identifier** of your app, e.g. 'com.example.my-app-123'. Accepts only alphanumeric characters (A-z and 0-9), and hyphens. Corresponds to the `PRODUCT_BUNDLE_IDENTIFIER` Xcode build variable, used to fill in the `CFBundleIdentifier` key in the `Info.plist` file.",
        ),
      ),
    }).configure(
      description("macOS-specific overrides for the default values (which are based on `name`)."),
    ),
    ["windows?"]: type({
      ["display_name?"]: type("string").configure(
        description(
          "The **display name** of your app, e.g. 'My App 123' or '俺のアプリ'. Accepts any string. Corresponds to the `ProjectName` value in the `.vcxproj` file. Will be used as the app name in Windows Explorer.",
        ),
      ),
      ["namespace?"]: Dns.configure(
        description(
          "The WinRT and C++ **namespace**, e.g. 'com.example.myapp123'. Accepts only alphanumeric characters (A-z and 0-9). When used in C++, `.` characters are converted to `::`, e.g. 'com::example::myapp123'.",
        ),
      ),
      ["project_name?"]: type("string.alphanumeric").configure(
        description(
          "A **filesafe name** for the app consisting only of alphanumeric characters (A-z, and 0-9), e.g. 'MyApp123'. Will be used mainly for file names, e.g. 'MyApp123.vcxproj'.",
        ),
      ),
    }).configure(
      description("Windows-specific overrides for the default values (which are based on `name`)."),
    ),
  });
}

export const PartialAppConfig = defineAppConfig({
  includeDescriptions: false,
});

export const PartialAppConfigForJsonSchema = defineAppConfig({
  includeDescriptions: true,
});
type PartialAppConfigType = typeof PartialAppConfig.infer;

export const AppConfig = defineAppConfig({ includeDescriptions: false });
