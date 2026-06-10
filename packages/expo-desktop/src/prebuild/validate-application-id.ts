import assert from "node:assert";

// TODO: Adjust to indicate that the bundle identifier must start with a letter, period, or hyphen.
const MACOS_BUNDLE_ID_REGEX = /^[a-zA-Z0-9-.]+$/;
const WINDOWS_NAMESPACE_REGEX = /^[a-zA-Z0-9.]+$/;

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

export function assertValidNamespace(value: string) {
  assert.match(
    value,
    WINDOWS_NAMESPACE_REGEX,
    `The windows.namespace defined in your Expo config is not formatted properly. Only alphanumeric characters and '.' are allowed, and each '.' must be followed by a letter.`,
  );
}
