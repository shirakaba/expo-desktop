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
  if (platforms.includes("macos")) {
    await getOrPromptForBundleIdentifierAsync(projectRoot);
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
  exp: ExpoConfig = getConfig(projectRoot).exp,
): Promise<string> {
  const current = (exp as ExpoConfig & { macos: ExpoConfig["ios"] }).macos?.bundleIdentifier;
  if (current) {
    assertValidBundleId(current);
    return current;
  }

  const rdns = await text({
    message: `Please provide the ${kleur.bold("bundle identifier")} for the macOS app. ${grey("(Example: 'com.example.my-app-123')")}`,
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
      // @ts-expect-error no 'macos' support
      { macos: { bundleIdentifier } },
      { macos: { bundleIdentifier } },
    )
  ) {
    log.message(kleur.gray(`\u203A Apple bundle identifier: ${bundleIdentifier}`));
  }

  return bundleIdentifier;
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
