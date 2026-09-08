import spawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import path from "node:path";

import type { DevServerManager } from "../../common/expo/start-bundler.ts";
import type { WindowsDevice } from "./WindowsBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";

/** Launch an existing Windows executable on the host Windows device. */
export async function launchAppAsync(
  binaryPath: string,
  _manager: DevServerManager,
  props: {
    isSimulator: false;
    device: WindowsDevice;
    shouldStartBundler: boolean;
  },
) {
  Log.log(chalk.gray`› Installing ${binaryPath}`);
  if (props.device.osType !== "Windows") {
    throw new Error("Unexpected non-Windows device while launching a Windows app.");
  }

  // `start` returns after handing the executable off to Windows, just as macOS `open` does.
  const args = ["/d", "/c", "start", "", binaryPath];
  try {
    await spawnAsync(process.env.ComSpec ?? "cmd.exe", args, {
      cwd: path.dirname(binaryPath),
      stdio: "ignore",
    });
  } catch (error: any) {
    if ("code" in error && error.code === 1) {
      throw new CommandError(
        "WINDOWS_LAUNCH",
        "Failed to launch the Windows binary: " +
          [process.env.ComSpec ?? "cmd.exe", ...args].join(" ") +
          "\n\n" +
          error.message,
      );
    }
    throw error;
  }
}
