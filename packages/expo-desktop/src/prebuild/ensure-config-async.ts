import type { ExpoConfig, PackageJSONConfig } from "@expo/config";
import type { ModPlatform } from "@expo/config-plugins";

import { isCancel, log, text } from "@clack/prompts";
import { getConfig } from "@expo/config";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";

import { attemptModification } from "./modify-config-async.ts";
import { assertValidBundleId, assertValidNamespace } from "./validate-application-id.ts";

/** Ensure config is written, and prompts for application identifiers. */
export async function ensureConfigAsync(
  projectRoot: string,
  {
    platforms,
  }: {
    platforms: Array<ModPlatform | "macos" | "windows">;
  },
): Promise<{ exp: ExpoConfig; pkg: PackageJSONConfig }> {
  if (platforms.includes("ios")) {
    await getOrPromptForBundleIdentifierAsync(projectRoot, "ios");
  }

  if (platforms.includes("macos")) {
    await getOrPromptForBundleIdentifierAsync(projectRoot, "macos");
  }

  if (platforms.includes("windows")) {
    await getOrPromptForNamespaceAsync(projectRoot);
  }

  // Read config again because prompting for bundle id or package name may have mutated the results.
  return getConfig(projectRoot);
}

/**
 * Get the bundle identifier from the Expo config or prompt the user to choose a
 * new bundle identifier.
 *
 * Prompted value will be validated against a local regex.
 *
 * If the project Expo config is a static JSON file, the bundle identifier will
 * be updated in the config automatically.
 */
export async function getOrPromptForBundleIdentifierAsync(
  projectRoot: string,
  platform: "ios" | "macos",
  exp: ExpoConfig = getConfig(projectRoot).exp,
): Promise<string> {
  const platformDisplayName = platform === "ios" ? "iOS" : "macOS";
  const current = (exp as ExpoConfig & { macos: ExpoConfig["ios"] })[platform]?.bundleIdentifier;
  if (current) {
    assertValidBundleId(current);
    return current;
  }

  const rdns = await text({
    message: `Please provide the ${kleur.bold("bundle identifier")} for the ${platformDisplayName} app. ${grey("(Example: 'com.example.my-app-123')")}`,
    placeholder: "com.example.my-app",
    initialValue: "com.example.my-app",
    validate(value) {
      if (!value?.length) {
        return "Must be at least one character long.";
      }
    },
  });
  if (isCancel(rdns)) {
    process.exit(0);
  }

  const bundleIdentifier = rdns.replaceAll("_", "-");

  // Apply the changes to the config.
  if (
    await attemptModification(
      projectRoot,
      { [platform]: { bundleIdentifier } },
      { [platform]: { bundleIdentifier } },
    )
  ) {
    log.message(kleur.gray(`\u203A ${platformDisplayName} bundle identifier: ${bundleIdentifier}`));
  }

  return bundleIdentifier;
}

/**
 * Get the Android package namespace from the Expo config or prompt the user to
 * choose a new one.
 *
 * Prompted value will be validated against a local regex.
 *
 * If the project Expo config is a static JSON file, the package name will be
 * updated in the config automatically.
 */
export async function getOrPromptForPackageAsync(
  projectRoot: string,
  exp: ExpoConfig = getConfig(projectRoot).exp,
): Promise<string> {
  const current = (exp as ExpoConfig).android?.package;
  if (current) {
    assertValidNamespace(current);
    return current;
  }

  const rdns = await text({
    message: `Please provide the ${kleur.bold("package")} for the Android app. ${grey("(Example: 'com.example.my_app_123')")}`,
    placeholder: "com.example.my_app",
    initialValue: "com.example.my_app",
    validate(value) {
      if (!value?.length) {
        return "Must be at least one character long.";
      }
    },
  });
  if (isCancel(rdns)) {
    process.exit(0);
  }

  const androidPackage = rdns.replaceAll(/[_-]/g, "_");

  // Apply the changes to the config.
  if (
    await attemptModification(
      projectRoot,
      { android: { package: androidPackage } },
      { android: { package: androidPackage } },
    )
  ) {
    log.message(kleur.gray(`\u203A Android package: ${androidPackage}`));
  }

  return androidPackage;
}

/**
 * Get the Windows namespace from the Expo config or prompt the user to choose a
 * new one.
 *
 * Prompted value will be validated against a local regex.
 *
 * If the project Expo config is a static JSON file, the package name will be
 * updated in the config automatically.
 */
export async function getOrPromptForNamespaceAsync(
  projectRoot: string,
  exp: ExpoConfig = getConfig(projectRoot).exp,
): Promise<string> {
  const current = (exp as ExpoConfig & { windows: { namespace: string } }).windows?.namespace;
  if (current) {
    assertValidNamespace(current);
    return current;
  }

  const rdns = await text({
    message: `Please provide the ${kleur.bold("namespace")} for the Windows app. ${grey("(Example: 'com.example.myapp123')")}`,
    placeholder: "com.example.myapp",
    initialValue: "com.example.myapp",
    validate(value) {
      if (!value?.length) {
        return "Must be at least one character long.";
      }
    },
  });
  if (isCancel(rdns)) {
    process.exit(0);
  }

  const windowsNamespace = rdns.replaceAll(/[_-]/g, "");

  // Apply the changes to the config.
  if (
    await attemptModification(
      projectRoot,
      // @ts-expect-error no 'windows' support
      { windows: { namespace: windowsNamespace } },
      { windows: { namespace: windowsNamespace } },
    )
  ) {
    log.message(kleur.gray(`\u203A Windows namespace: ${windowsNamespace}`));
  }

  return windowsNamespace;
}
