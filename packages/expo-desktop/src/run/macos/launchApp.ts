import spawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import type { DevServerManager } from "../../common/expo/start-bundler.ts";
import type { MacosDevice } from "./XcodeBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
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
  const args = ["-b", appId, binaryPath];
  try {
    await spawnAsync("open", args);
  } catch (error: any) {
    if ("code" in error && error.code === 1) {
      throw new CommandError(
        "MACOS_LAUNCH",
        "Failed to launch the compatible binary on macOS: open " +
          args.join(" ") +
          "\n\n" +
          error.message,
      );
    }
    throw error;
  }
}

async function getBundleIdentifierAsync(binaryPath: string): Promise<string> {
  const infoPlistPaths = [
    path.join(binaryPath, "Contents", "Info.plist"),
    path.join(binaryPath, "Info.plist"),
  ];
  const infoPlistPath = infoPlistPaths.find((candidate) => fs.existsSync(candidate));
  if (!infoPlistPath) {
    throw new CommandError(
      "MACOS_LAUNCH",
      `Could not find Info.plist in the macOS app bundle: ${binaryPath}`,
    );
  }

  const result = await spawnAsync("/usr/libexec/PlistBuddy", [
    "-c",
    "Print:CFBundleIdentifier",
    infoPlistPath,
  ]);
  const bundleIdentifier = result.stdout.trim();
  if (!bundleIdentifier) {
    throw new CommandError(
      "MACOS_LAUNCH",
      `CFBundleIdentifier was not found in the macOS app bundle: ${binaryPath}`,
    );
  }
  return bundleIdentifier;
}
