import type { ExpoConfig, PackageJSONConfig } from "@expo/config";
import type { ModPlatform } from "@expo/config-plugins";
import type withExpoDesktop from "expo-desktop-config-plugins/plugins/with-expo-desktop";

import { isCancel, log, text } from "@clack/prompts";
import { getConfig } from "@expo/config";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";
import crypto from "node:crypto";

import { readAppNameFromConfig } from "../common/read-app-name-from-config.ts";
import { attemptModification } from "./modify-config-async.ts";
import {
  assertValidAndroidNamespace,
  assertValidBundleId,
  assertValidGuid,
  assertValidWindowsNamespace,
} from "./validate-application-id.ts";

/**
 * Ensure config is written, and prompts for application identifiers.
 * See also: packages/expo-desktop/src/prebuild/expo/configure-project-async.ts
 */
export async function ensureConfigAsync(
  projectRoot: string,
  {
    platforms,
  }: {
    platforms: Array<ModPlatform | "macos" | "windows">;
  },
): Promise<{ exp: ExpoConfig; pkg: PackageJSONConfig }> {
  if (platforms.includes("android")) {
    await getOrPromptForPackageAsync(projectRoot);
  }

  if (platforms.includes("ios")) {
    await getOrPromptForBundleIdentifierAsync(projectRoot, "ios");
  }

  if (platforms.includes("macos")) {
    await getOrPromptForBundleIdentifierAsync(projectRoot, "macos");
  }

  if (platforms.includes("windows")) {
    await getOrPromptForNamespaceAsync(projectRoot);
    await getOrGenerateGuidsAsync(projectRoot);
  }

  await getOrPromptForDisplayNameAsync(projectRoot);

  // Read config again because any of the above actions may have mutated the
  // results.
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
  const otherPlatformDisplayName = platform === "ios" ? "macOS" : "iOS";
  const typedConfig = exp as ExpoConfig & { macos: ExpoConfig["ios"] };

  const current = typedConfig[platform]?.bundleIdentifier;
  if (current) {
    assertValidBundleId(current);
    return current;
  }

  // Typically you'll want to use the same bundle identifier across both iOS and
  // macOS in order to share the same App Store page, so we fall back to
  // whichever the other Apple platform is.
  const fallback = typedConfig[platform === "ios" ? "macos" : "ios"]?.bundleIdentifier;
  const rdns = await text({
    ...(fallback
      ? {
          message: `Please provide the ${kleur.bold("bundle identifier")} for the ${platformDisplayName} app. ${grey(`(Default: '${fallback}' - same as ${otherPlatformDisplayName}, to share the same App Store page)`)}`,
          placeholder: fallback,
          initialValue: fallback,
        }
      : {
          message: `Please provide the ${kleur.bold("bundle identifier")} for the ${platformDisplayName} app. ${grey("(Example: 'com.example.my-app-123')")}`,
          placeholder: "com.example.my-app",
          initialValue: "com.example.my-app",
        }),
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
 * Get the display name from the Expo config, or prompt the user to choose one.
 *
 * If the project Expo config is a static JSON file, the display name will be
 * updated in the config automatically.
 */
export async function getOrPromptForDisplayNameAsync(
  projectRoot: string,
  exp: ExpoConfig = getConfig(projectRoot).exp,
): Promise<string> {
  const { displayName: current } = readAppNameFromConfig(exp);

  if (current) {
    return current;
  }

  const displayName = await text({
    message: `Please provide the ${kleur.bold("display name")} for the app. ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
    placeholder: "My App",
    initialValue: "My App",
    validate(value) {
      if (!value?.length) {
        return "Must be at least one character long.";
      }
    },
  });
  if (isCancel(displayName)) {
    process.exit(0);
  }

  await ensureExpoDesktopConfigPlugins(projectRoot, { displayName });

  return displayName;
}

export async function ensureExpoDesktopConfigPlugins(
  projectRoot: string,
  props: Parameters<typeof withExpoDesktop>[1],
  exp: ExpoConfig = getConfig(projectRoot).exp,
) {
  const existingPlugins = exp.plugins ?? [];
  const existingIndex = existingPlugins.findIndex(
    (plugin) => plugin[0] === "expo-desktop-config-plugins",
  );
  const leading = existingIndex === -1 ? [] : existingPlugins.slice(0, existingIndex);
  const existingProps = existingIndex === -1 ? {} : (existingPlugins[existingIndex][1] ?? {});
  const trailing =
    existingIndex === -1 ? existingPlugins : existingPlugins.slice(existingIndex + 1);

  // Apply the changes to the config.
  if (
    await attemptModification(
      projectRoot,
      {
        plugins: [
          ...leading,
          ["expo-desktop-config-plugins", { ...existingProps, ...props }],
          ...trailing,
        ],
      },
      {
        plugins: [
          ...leading,
          ["expo-desktop-config-plugins", { ...existingProps, ...props }],
          ...trailing,
        ],
      },
    )
  ) {
    log.message(
      kleur.gray(
        `\u203A ${existingIndex === -1 ? "Added" : "Updated"} "expo-desktop-config-plugins" with given props`,
      ),
    );
  }
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
    assertValidAndroidNamespace(current);
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
    assertValidWindowsNamespace(current);
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

/**
 * Get the Windows UUID from the Expo config or generate one afresh.
 */
export async function getOrGenerateGuidsAsync(
  projectRoot: string,
  exp: ExpoConfig = getConfig(projectRoot).exp,
) {
  const current = (exp as ExpoConfig & { windows: { projectGuid?: string; packageGuid?: string } })
    .windows;

  let didGenerateGuid = false;

  let projectGuid = current?.projectGuid;
  if (projectGuid) {
    assertValidGuid(projectGuid, "windows.projectGuid");
  } else {
    projectGuid = crypto.randomUUID();
    didGenerateGuid = true;
  }

  let packageGuid = current?.packageGuid;
  if (packageGuid) {
    assertValidGuid(packageGuid, "windows.packageGuid");
  } else {
    packageGuid = crypto.randomUUID();
    didGenerateGuid = true;
  }

  if (!didGenerateGuid) {
    return { projectGuid, packageGuid };
  }

  // Apply the changes to the config.
  if (
    await attemptModification(
      projectRoot,
      // @ts-expect-error no 'windows' support
      { windows: { projectGuid, packageGuid } },
      { windows: { projectGuid, packageGuid } },
    )
  ) {
    log.message(kleur.gray(`\u203A Generated windows projectGuid and/or packageGuid.`));
  }

  return { projectGuid, packageGuid };
}
