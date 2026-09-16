import chalk from "chalk";
import path from "node:path";

import type { Options } from "./WindowsBuild.types.ts";

import * as Log from "../../common/expo/log.ts";
import { ensurePortAvailabilityAsync } from "../../common/expo/port.ts";
import { profile } from "../../common/expo/profile.ts";
import { logProjectLogsLocation } from "../../common/expo/run-hints.ts";
import { startBundlerAsync } from "../../common/expo/start-bundler.ts";
import { loadEnvFiles, setNodeEnv } from "../../common/node-env.ts";
import { loadConfigAsync } from "../load-config.ts";
import { ensureNativeProjectAsync } from "./ensureNativeProject.ts";
import { waitForExistingInstancesToTerminateAsync } from "./launchApp.ts";
import { resolveOptionsAsync } from "./options/resolveOptions.ts";
import { autolinkWindows, cleanAsync, runWindows } from "./RNWCLI.ts";
import {
  exportWindowsBuildArtifactsAsync,
  resolveWindowsBuildArtifactsAsync,
  restoreWindowsBuildArtifactsAsync,
} from "./WindowsBinary.ts";

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

  // Autolinking prepares the native project independently of whether the app
  // will be built now or restored from --binary.
  if (props.runWindowsOptions.autolink) {
    await autolinkWindows(projectRoot, rncliConfig, {
      check: false,
      ...(props.runWindowsOptions.logging !== undefined
        ? { logging: props.runWindowsOptions.logging }
        : {}),
      ...(props.runWindowsOptions.telemetry !== undefined
        ? { telemetry: props.runWindowsOptions.telemetry }
        : {}),
    });
  }

  const windowsRoot = path.resolve(projectRoot, "windows");

  if (options.binary) {
    const artifacts = await resolveWindowsBuildArtifactsAsync(
      options.binary,
      props.runWindowsOptions.arch,
      props.configuration,
    );
    await restoreWindowsBuildArtifactsAsync(
      artifacts,
      windowsRoot,
      props.runWindowsOptions.arch,
      props.configuration,
    );
    Log.log(`Using custom Windows build artifacts: ${path.resolve(options.binary)}`);
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
    await runWindows(projectRoot, rncliConfig, {
      ...props.runWindowsOptions,
      // Expo starts Metro after the native build completes.
      packager: false,
      // Autolinking already ran on the common path above.
      autolink: false,
      // Deployment and launch happen after Expo's dev server is ready.
      deploy: false,
      launch: false,
    });

    // TODO: build cache providers
  }

  // Copy the binary to the output directory if specified.
  if (options.output) {
    const artifacts = await resolveWindowsBuildArtifactsAsync(
      windowsRoot,
      props.runWindowsOptions.arch,
      props.configuration,
    );
    const exported = await exportWindowsBuildArtifactsAsync(
      artifacts,
      options.output,
      props.runWindowsOptions.arch,
      props.configuration,
    );
    Log.log(`Copied Windows build artifacts to: ${exported.windowsRoot}`);
  }

  Log.debug(`windows:binary_path ${windowsRoot}`);

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

  // Deploy and optionally launch the already-built package on the Windows
  // host.
  if (props.runWindowsOptions.launch) {
    await waitForExistingInstancesToTerminateAsync(path.parse(props.windowsProject.project).name);
  }

  await runWindows(projectRoot, rncliConfig, {
    ...props.runWindowsOptions,
    // Expo owns Metro and the developer interface for the lifetime of this
    // command.
    packager: false,
    // Autolinking ran before the build/restore branch, and any native build
    // completed before the dev server started.
    autolink: false,
    build: false,
  });

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
