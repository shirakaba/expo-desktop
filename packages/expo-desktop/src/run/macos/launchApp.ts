import spawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { DevServerManager } from "../../common/expo/start-bundler.ts";
import type { MacosDevice } from "./XcodeBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { parsePlistAsync } from "./expo/plist.ts";

type BinaryLaunchInfo = {
  bundleId: string;
  schemes: Array<string>;
};

/** Install and launch the app binary on the host macOS device. */
export async function launchAppAsync(
  binaryPath: string,
  _manager: DevServerManager,
  props: {
    isSimulator: false;
    device: MacosDevice;
    shouldStartBundler: boolean;
    background: boolean;
    singleInstance: boolean;
    bundleId: string;
  },
) {
  Log.log(chalk.gray`› Launching ${binaryPath}`);
  if (props.device.osType !== "macOS") {
    throw new Error("Unexpected non-macOS device while launching a macOS app.");
  }

  if (props.singleInstance) {
    await waitForExistingInstancesToTerminateAsync(props.bundleId);
  }

  const args = [
    ...(props.background ? ["--background"] : []),
    ...(!props.singleInstance ? ["--new"] : []),
    binaryPath,
  ];
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

async function waitForExistingInstancesToTerminateAsync(bundleId: string) {
  const scriptPath = fileURLToPath(
    new URL("../../../scripts/terminateApp.jxa.js", import.meta.url),
  );
  const terminationTimeoutSeconds = 60;
  await spawnAsync("osascript", [
    "-l",
    "JavaScript",
    scriptPath,
    bundleId,
    terminationTimeoutSeconds.toString(),
  ]);
}

export async function getLaunchInfoForBinaryAsync(binaryPath: string): Promise<BinaryLaunchInfo> {
  const builtInfoPlistPath = path.join(binaryPath, "Contents", "Info.plist");
  const { CFBundleIdentifier, CFBundleURLTypes } = await parsePlistAsync(builtInfoPlistPath);

  let schemes = new Array<string>();

  if (Array.isArray(CFBundleURLTypes)) {
    schemes =
      CFBundleURLTypes.reduce<Array<string>>((acc, urlType: unknown) => {
        if (
          urlType &&
          typeof urlType === "object" &&
          "CFBundleURLSchemes" in urlType &&
          Array.isArray(urlType.CFBundleURLSchemes)
        ) {
          return [...acc, ...urlType.CFBundleURLSchemes];
        }
        return acc;
      }, []) ?? [];
  }

  return { bundleId: CFBundleIdentifier, schemes };
}
