import chalk from "chalk";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { Options } from "./WindowsBuild.types.ts";

import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { ensurePortAvailabilityAsync } from "../../common/expo/port.ts";
import { profile } from "../../common/expo/profile.ts";
import { logProjectLogsLocation } from "../../common/expo/run-hints.ts";
import { startBundlerAsync } from "../../common/expo/start-bundler.ts";
import { loadEnvFiles, setNodeEnv } from "../../common/node-env.ts";
import { copyBinaryToOutputAsync } from "../copy-binary.ts";
import { loadConfigAsync } from "../load-config.ts";
import { ensureNativeProjectAsync } from "./ensureNativeProject.ts";
import { launchAppAsync } from "./launchApp.ts";
import { resolveOptionsAsync } from "./options/resolveOptions.ts";
import { runWindows } from "./RNWCLI.ts";
import * as WindowsBuild from "./WindowsBuild.ts";

const require = createRequire(import.meta.url);

export async function runWindowsAsync(projectRoot: string, options: Options) {
  const mode = options.configuration === "Release" ? "production" : "development";
  setNodeEnv(mode);
  loadEnvFiles(projectRoot, { mode });

  // assertPlatform();

  const install = !!options.install;

  await ensureNativeProjectAsync(projectRoot, { install });

  // Resolve the CLI arguments into useable options.
  const props = await profile(resolveOptionsAsync)(projectRoot, options);

  if (props.device) {
    Log.log(`› Using ${props.device.name}`);
  }

  // Calls the same underlying function as `rnc-cli config` does.
  const rncliConfig = await loadConfigAsync({ projectRoot, selectedPlatform: "windows" });
  console.log(rncliConfig);

  let binaryPath: string | undefined;
  if (options.binary) {
    binaryPath = await getValidBinaryPathAsync(options.binary);
    Log.log("Using custom binary path:", binaryPath);
  } else {
    // Spawn the `rnc-cli` process to create the app binary.
    // await WindowsBuild.buildAsync(props);
    await runWindows(rncliConfig, {
      ...props.runWindowsOptions,
      // Run the packager ourselves upon startBundlerAsync().
      packager: false,
      // Launch as a separate call to the CLI.
      launch: false,
    });

    // FIXME: Having built the binary, we must set the binaryPath.
    //        This should be the path to the Package, not the .exe.
    binaryPath = "TODO";
  }

  // Copy the binary to the output directory if specified.
  if (options.output) {
    binaryPath = await copyBinaryToOutputAsync(binaryPath, options.output);
  }

  Log.debug(`windows:binary_path ${binaryPath}`);

  // Ensure the port hasn't become busy during the build.
  if (props.shouldStartBundler && !(await ensurePortAvailabilityAsync(projectRoot, props))) {
    props.shouldStartBundler = false;
  }

  // Start the dev server which creates all of the required info for
  // launching the app on the host device.
  const manager = await startBundlerAsync(projectRoot, {
    port: props.port,
    mode,
    headless: !props.shouldStartBundler,
  });

  // FIXME: Significant divergence here. For macOS, this was just launchAppAsync().
  //        WindowsBuild.deployAsync() seems to be about launching an
  //        already-built app via RNCLI (which may give you debug, I dunno),
  //        while launchAppAsync() just opens the .exe.
  try {
    // Install and launch the app binary on the host device.
    if (binaryPath) {
      // Just build, but don't launch?
      // cmd.exe /d /c start binaryPath
      await launchAppAsync(binaryPath, manager, {
        isSimulator: false,
        device: props.device,
        shouldStartBundler: props.shouldStartBundler,
      });
    } else {
      // Build and launch?
      // rnc-cli run-windows \
      //   --no-packager \
      //   --sln pathToSln \
      //   --proj pathToProj \
      //   [--release] \
      //   --no-build \
      //   --no-autolink
      //
      // The actual deploy
      //
      // RNW has both deployToDevice and deployToDesktop
      // it can deploy to both devices and emulators..!
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
