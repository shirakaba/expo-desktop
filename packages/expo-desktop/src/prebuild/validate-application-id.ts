import assert from "node:assert";

// TODO: Adjust to indicate that the bundle identifier must start with a letter, period, or hyphen.
const MACOS_BUNDLE_ID_REGEX = /^[a-zA-Z0-9-.]+$/;
const ANDROID_NAMESPACE_REGEX = /^[a-zA-Z0-9_.]+$/;
const WINDOWS_NAMESPACE_REGEX = /^[a-zA-Z0-9.]+$/;
/**
 * The React Native Windows project template has both V1 and V4 GUIDs in it:
 * - V1: 8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942
 * - V4: C7167F0D-BC9F-4E6E-AFE1-012C56B48DB5
 * As I don't know what I'm up against, given it's closed-source, let's just
 * accept any UUID from v1 to v8.
 * @see https://github.com/microsoft/react-native-windows/blob/cdca047ea950fb061c04ca09e2d172fef5811e02/vnext/templates/cpp-app/windows/MyApp.sln#L6-L14
 * @see https://en.wikipedia.org/wiki/Universally_unique_identifier
 */
const UUID_V1_to_V8_REGEX =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;

/** Validate a macOS bundle identifier. */
export function validateBundleId(value: string): boolean {
  return MACOS_BUNDLE_ID_REGEX.test(value);
}

export function assertValidBundleId(value: string) {
  assert.match(
    value,
    MACOS_BUNDLE_ID_REGEX,
    `The macos.bundleIdentifier defined in your Expo config is not formatted properly. Only alphanumeric characters, '.', '-', and '_' are allowed, and each '.' must be followed by a letter.`,
  );
}

export function assertValidAndroidNamespace(value: string) {
  assert.match(
    value,
    ANDROID_NAMESPACE_REGEX,
    `The android.package defined in your Expo config is not formatted properly. Only alphanumeric characters, '_', and '.' are allowed, and each '.' must be followed by a letter.`,
  );
}

export function assertValidWindowsNamespace(value: string) {
  assert.match(
    value,
    WINDOWS_NAMESPACE_REGEX,
    `The windows.namespace defined in your Expo config is not formatted properly. Only alphanumeric characters and '.' are allowed, and each '.' must be followed by a letter.`,
  );
}

export function assertValidGuid(value: string, field: string) {
  assert.match(
    value,
    UUID_V1_to_V8_REGEX,
    `The ${field} GUID defined in your Expo config is not formatted properly. Make sure it's a valid UUID v4 value.`,
  );
}
