import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { MacOSConfig } =
  require("expo-desktop-config-plugins") as typeof import("expo-desktop-config-plugins");
const plist = require("@expo/plist") as typeof import("@expo/plist").default;

// sort longest to ensure uniqueness.
// this might be undesirable as it causes the QR code to be longer.
function sortLongest(obj: string[]): string[] {
  return obj.sort((a, b) => b.length - a.length);
}

/**
 * Resolve the scheme for the dev client using two methods:
 *   - filter on known Expo schemes, starting with `exp+`, avoiding 3rd party schemes.
 *   - filter on longest to ensure uniqueness.
 */
function resolveExpoOrLongestScheme(schemes: string[]): string[] {
  const expoOnlySchemes = schemes.filter((scheme) => scheme.startsWith("exp+"));
  return expoOnlySchemes.length > 0 ? sortLongest(expoOnlySchemes) : sortLongest(schemes);
}

// TODO: Revisit and test after run code is merged.
export async function getSchemesForMacosAsync(projectRoot: string): Promise<string[]> {
  try {
    const infoPlistBuildProperty = MacOSConfig.getInfoPlistPath.getInfoPlistPathFromPbxproj(
      projectRoot,
      "macos",
    );
    if (infoPlistBuildProperty) {
      // event("scheme_ios_plist_path", { path: infoPlistBuildProperty });
      const configPath = path.join(projectRoot, "ios", infoPlistBuildProperty);
      const rawPlist = fs.readFileSync(configPath, "utf8");
      const plistObject = plist.parse(rawPlist);
      const schemes = MacOSConfig.Scheme.getSchemesFromPlist(plistObject);
      // event("scheme_ios_schemes", { schemes });
      return resolveExpoOrLongestScheme(schemes);
    }
  } catch (error) {
    // event("scheme_ios_error", { error: event.error(error as Error) });
  }

  // No ios folder or some other error
  return [];
}
