import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import type { Options } from "./WindowsBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { ensurePortAvailabilityAsync } from "../../common/expo/port.ts";
import { profile } from "../../common/expo/profile.ts";
import { logProjectLogsLocation } from "../../common/expo/run-hints.ts";
import { startBundlerAsync, type DevServerManager } from "../../common/expo/start-bundler.ts";
import { loadEnvFiles, setNodeEnv } from "../../common/node-env.ts";
import { ensureNativeProjectAsync } from "./ensureNativeProject.ts";
import { launchAppAsync } from "./launchApp.ts";
import { resolveOptionsAsync } from "./options/resolveOptions.ts";
import * as WindowsBuild from "./WindowsBuild.ts";

export async function runWindowsAsync(projectRoot: string, options: Options) {
  const mode = options.configuration === "Release" ? "production" : "development";
  setNodeEnv(mode);
  loadEnvFiles(projectRoot, { mode });

  assertPlatform();

  const install = !!options.install;

  await ensureNativeProjectAsync(projectRoot, { install });

  // Resolve the CLI arguments into useable options.
  const props = await profile(resolveOptionsAsync)(projectRoot, options);

  if (props.device) {
    Log.log(`› Using ${props.device.name}`);
  }

  let binaryPath: string | undefined;
  if (options.binary) {
    binaryPath = await getValidBinaryPathAsync(options.binary);
    Log.log("Using custom binary path:", binaryPath);
  }

  if (!binaryPath) {
    // Spawn the `rnc-cli` process to create the app binary.
    await WindowsBuild.buildAsync(props);
  }

  // Ensure the port hasn't become busy during the build.
  if (props.shouldStartBundler && !(await ensurePortAvailabilityAsync(projectRoot, props))) {
    props.shouldStartBundler = false;
  }

  // Start the dev server which creates all of the required info for
  // launching the app on the host device.
  const manager: DevServerManager = props.shouldStartBundler
    ? await startBundlerAsync(projectRoot, {
        port: props.port,
        mode,
        headless: false,
      })
    : {
        async stopAsync() {},
      };

  try {
    // Install and launch the app binary on the host device.
    if (binaryPath) {
      await launchAppAsync(binaryPath, manager, {
        isSimulator: false,
        device: props.device,
        shouldStartBundler: props.shouldStartBundler,
      });
    } else {
      await WindowsBuild.deployAsync(props);
    }
  } catch (error) {
    await manager.stopAsync();
    throw error;
  }

  // Log the location of the JS logs for the host device.
  if (props.shouldStartBundler) {
    logProjectLogsLocation();
  } else {
    await manager.stopAsync();
  }
}

function assertPlatform() {
  if (process.platform !== "win32") {
    Log.exit(
      chalk`Windows apps can only be built on Windows devices. Run this command on Windows with Visual Studio installed.`,
    );
  }
}

async function getValidBinaryPathAsync(input: string): Promise<string> {
  const resolved = path.resolve(input);

  if (!fs.existsSync(resolved)) {
    throw new CommandError(
      "WINDOWS_BINARY",
      `The path to the Windows binary does not exist: ${resolved}`,
    );
  }
  if (path.extname(resolved).toLowerCase() !== ".exe") {
    throw new CommandError(
      "WINDOWS_BINARY",
      `The Windows binary must be an .exe file: ${resolved}`,
    );
  }
  return resolved;
}
