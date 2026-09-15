import chalk from "chalk";
import fs from "node:fs";
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
import { cleanAsync, runWindows } from "./RNWCLI.ts";

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

  // Calls the same underlying function as `rnc-cli config` does.
  const rncliConfig = await loadConfigAsync({ projectRoot, selectedPlatform: "windows" });

  let binaryPath: string | undefined;
  if (options.binary) {
    binaryPath = await getValidBinaryPathAsync(options.binary);
    Log.log("Using custom binary path:", binaryPath);
  } else {
    // TODO: eager bundling

    if (!props.buildCache) {
      await cleanAsync({
        arch: props.runWindowsOptions.arch,
        configuration: props.configuration,
        projectRoot: props.projectRoot,
        // FIXME: fill in solution inside resolveOptionsAsync()
        solution: props.runWindowsOptions.sln!,
      });
    }

    // Build the app package.
    await runWindows(rncliConfig, {
      ...props.runWindowsOptions,
      // Expo starts Metro after the native build completes.
      packager: false,
      // Deployment and launch happen after Expo's dev server is ready.
      deploy: false,
      launch: false,
    });

    // FIXME: Having built the binary, we must set the binaryPath.
    //        This should be the path to the Package, not the .exe.
    binaryPath = "TODO";
    // TODO: build cache providers
  }

  // Copy the binary to the output directory if specified.
  if (options.output) {
    binaryPath = await copyBinaryToOutputAsync(binaryPath, options.output);
  }

  Log.debug(`windows:binary_path ${binaryPath}`);

  // A build-only run has nothing that needs Metro or the developer interface.
  if (!props.runWindowsOptions.launch) {
    return;
  }

  // Ensure the port hasn't become busy during the build.
  if (props.shouldStartBundler && !(await ensurePortAvailabilityAsync(projectRoot, props))) {
    props.shouldStartBundler = false;
  }

  // Start Expo's Metro server and, for interactive runs, its developer
  // interface before RNW launches the app on the host device.
  const manager = await startBundlerAsync(projectRoot, {
    port: props.port,
    mode,
    headless: !props.shouldStartBundler,
  });

  // A custom executable can be launched directly. Normal RNW builds must go
  // through RNW so the app package is installed, granted loopback access, and
  // launched by package identity.
  if (binaryPath) {
    await launchAppAsync(binaryPath, manager, {
      isSimulator: false,
      device: props.device,
      shouldStartBundler: props.shouldStartBundler,
    });
  } else {
    // Deploy and optionally launch the already-built package on the Windows
    // host.
    await runWindows(rncliConfig, {
      ...props.runWindowsOptions,
      // Expo owns Metro and the developer interface for the lifetime of this
      // command.
      packager: false,
      // The first RNW invocation already performed these steps.
      autolink: false,
      build: false,
    });
  }

  // Log the location of the JS logs for the host device.
  if (props.shouldStartBundler) {
    logProjectLogsLocation();
  } else {
    await manager.stopAsync();
  }

  // TODO: build cache providers
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
