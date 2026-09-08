import spawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import type { DevServerManager } from "../../common/expo/start-bundler.ts";
import type { MacosDevice } from "./XcodeBuild.types.ts";

import * as Log from "../../common/expo/log.ts";

/** Install and launch the app binary on the host macOS device. */
export async function launchAppAsync(
  binaryPath: string,
  _manager: DevServerManager,
  props: {
    isSimulator: false;
    device: MacosDevice;
    shouldStartBundler: boolean;
  },
) {
  Log.log(chalk.gray`› Installing ${binaryPath}`);
  if (props.device.osType !== "macOS") {
    throw new Error("Unexpected non-macOS device while launching a macOS app.");
  }

  const appId = await getBundleIdentifierAsync(binaryPath);
  Log.log(chalk.gray`› Opening ${binaryPath}${appId ? ` (${appId})` : ""}`);
  await spawnAsync("open", appId ? ["-b", appId, "-a", binaryPath] : [binaryPath]);
}

async function getBundleIdentifierAsync(binaryPath: string): Promise<string | null> {
  const infoPlistPaths = [
    path.join(binaryPath, "Contents", "Info.plist"),
    path.join(binaryPath, "Info.plist"),
  ];
  const infoPlistPath = infoPlistPaths.find((candidate) => fs.existsSync(candidate));
  if (!infoPlistPath) {
    return null;
  }

  try {
    const result = await spawnAsync("/usr/libexec/PlistBuddy", [
      "-c",
      "Print:CFBundleIdentifier",
      infoPlistPath,
    ]);
    return result.stdout.trim() || null;
  } catch {
    // `open <path>` is still a valid fallback for custom app bundles whose
    // Info.plist cannot be read by PlistBuddy.
    return null;
  }
}
