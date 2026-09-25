import type { RunOptions } from "@expo/config";

import spawnAsync from "@expo/spawn-async";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import type { Options } from "./XcodeBuild.types.ts";

import { maybePromptToSyncPodsAsync } from "../../common/expo/cocoapods.ts";
import { CommandError } from "../../common/expo/error.ts";
import * as Log from "../../common/expo/log.ts";
import { ensurePortAvailabilityAsync } from "../../common/expo/port.ts";
import { profile } from "../../common/expo/profile.ts";
import { logProjectLogsLocation } from "../../common/expo/run-hints.ts";
import { startBundlerAsync } from "../../common/expo/start-bundler.ts";
import { loadEnvFiles, setNodeEnv } from "../../common/node-env.ts";
import { copyBinaryToOutputAsync } from "../copy-binary.ts";
import { ensureNativeProjectAsync } from "./ensureNativeProject.ts";
import {
  resolveBuildCache,
  uploadBuildCache,
} from "./expo/build-cache-providers/build-cache-providers.ts";
import { exportEagerAsync } from "./expo/exportEager.ts";
import { getSchemesForMacosAsync } from "./expo/scheme.ts";
import {
  getLaunchInfoForBinaryAsync,
  launchAppAsync,
  waitForExistingInstancesToTerminateAsync,
} from "./launchApp.ts";
import { resolveOptionsAsync } from "./options/resolveOptions.ts";
import * as XcodeBuild from "./XcodeBuild.ts";

export async function runMacosAsync(projectRoot: string, options: Options) {
  const mode = options.configuration === "Release" ? "production" : "development";
  setNodeEnv(mode);
  loadEnvFiles(projectRoot, { mode });

  assertPlatform();

  const install = !!options.install;

  if ((await ensureNativeProjectAsync(projectRoot, { install })) && install) {
    await maybePromptToSyncPodsAsync(projectRoot, "macos");
  }

  // Resolve the CLI arguments into useable options.
  const props = await profile(resolveOptionsAsync)(projectRoot, options);
  const runOptions: RunOptions = { ...options, port: props.port };

  if (props.device) {
    Log.log(`› Using ${props.device.name}`);
  }

  if (!options.binary && props.buildCacheProvider) {
    const localPath = await resolveBuildCache({
      projectRoot,
      platform: "macos",
      runOptions,
      provider: props.buildCacheProvider,
    });
    if (localPath) {
      options.binary = localPath;
    }
  }

  if (options.rebundle) {
    Log.warn(`The --unstable-rebundle flag is experimental and may not work as expected.`);
    // Get the existing binary path to re-bundle the app.

    if (!options.binary) {
      // TODO: Maybe try to fish this out of DerivedData.
      throw new Error(
        "Re-bundling on macOS requires the --binary flag. Please provide the path to your .app.",
      );
    }

    Log.log("Rebundling the Expo config file");
    // Re-bundle the config file the same way the app was originally bundled.
    await spawnAsync("node", [
      // TODO(@kitten): This isn't correct. The template installs expo-constants, but expo also depends on it
      // This however means that the top-level module doesn't have to exist. With isolated dependencies this will then fail
      // But we can't resolve via `expo` because that then may do something differently than autolinking if the root has a different version
      path.join(require.resolve("expo-constants/package.json"), "../scripts/getAppConfig.js"),
      projectRoot,
      path.join(options.binary, "Contents/Resources/EXConstants.bundle"),
    ]);
    // Re-bundle the app.

    const possibleBundleOutput = path.join(options.binary, "Contents/Resources/main.jsbundle");

    if (fs.existsSync(possibleBundleOutput)) {
      Log.log("Rebundling the app...");
      await exportEagerAsync(projectRoot, {
        resetCache: false,
        dev: false,
        platform: "macos",
        // TODO: Confirm that "assets" is indeed under "Resources".
        assetsDest: path.join(options.binary, "Contents/Resources/assets"),
        bundleOutput: possibleBundleOutput,
      });
    } else {
      Log.warn("Bundle output not found at expected location:", possibleBundleOutput);
    }
  }

  let binaryPath: string;
  let shouldUpdateBuildCache = false;
  if (options.binary) {
    binaryPath = await getValidBinaryPathAsync(options.binary);
    Log.log("Using custom binary path:", binaryPath);
  } else {
    let eagerBundleOptions: string | undefined;

    if (mode === "production") {
      eagerBundleOptions = JSON.stringify(
        await exportEagerAsync(projectRoot, {
          dev: false,
          platform: "macos",
        }),
      );
    }

    // Spawn the `xcodebuild` process to create the app binary.
    let buildOutput: string;
    try {
      buildOutput = await XcodeBuild.buildAsync({
        ...props,
        ...(eagerBundleOptions !== undefined ? { eagerBundleOptions } : {}),
      });
    } catch (error) {
      throw error;
    }

    // Find the path to the built app binary, this will be used to open the binary
    // on the host device.
    binaryPath = profile(XcodeBuild.getAppBinaryPath)(buildOutput);
    shouldUpdateBuildCache = true;
  }

  // Copy the binary to the output directory if specified.
  if (options.output) {
    binaryPath = await copyBinaryToOutputAsync(binaryPath, options.output);
  }

  Log.debug(`macos:binary_path ${binaryPath}`);

  // Ensure the port hasn't become busy during the build.
  if (props.shouldStartBundler && !(await ensurePortAvailabilityAsync(projectRoot, props))) {
    props.shouldStartBundler = false;
  }

  const launchInfo = await getLaunchInfoForBinaryAsync(binaryPath);
  const isCustomBinary = !!options.binary;
  const singleInstance = options.singleInstance ?? true;

  // Finish the termination spinner before Metro takes over terminal output.
  if (singleInstance) {
    await waitForExistingInstancesToTerminateAsync(launchInfo.bundleId);
  }

  // Start the dev server which creates all of the required info for launching
  // the app on the host device.
  const manager = await startBundlerAsync(projectRoot, {
    port: props.port,
    mode,
    headless: !props.shouldStartBundler,
    // If a scheme is specified then use that instead of the package name.

    scheme: isCustomBinary
      ? // If launching a custom binary, use the schemes in the Info.plist.
        launchInfo.schemes[0]
      : // If a scheme is specified then use that instead of the package name.
        (await getSchemesForMacosAsync(projectRoot))?.[0],
  });

  // Install and launch the app binary on the host device.
  await launchAppAsync(binaryPath, manager, {
    isSimulator: false,
    device: props.device,
    shouldStartBundler: props.shouldStartBundler,
    background: options.background ?? true,
    singleInstance,
  });

  // Log the location of the JS logs for the host device.
  if (props.shouldStartBundler) {
    logProjectLogsLocation();
  } else {
    await manager.stopAsync();
  }

  if (shouldUpdateBuildCache && props.buildCacheProvider) {
    await uploadBuildCache({
      projectRoot,
      platform: "macos",
      provider: props.buildCacheProvider,
      buildPath: binaryPath,
      runOptions,
    });
  }
}

function assertPlatform() {
  if (process.platform !== "darwin") {
    Log.exit(
      chalk`macOS apps can only be built on macOS devices. Run this command on macOS with Xcode installed.`,
    );
  }
}

async function getValidBinaryPathAsync(input: string): Promise<string> {
  const resolved = path.resolve(input);

  if (!fs.existsSync(resolved)) {
    throw new CommandError(
      "MACOS_BINARY",
      `The path to the macOS binary does not exist: ${resolved}`,
    );
  }
  if (!resolved.endsWith(".app")) {
    throw new CommandError("MACOS_BINARY", `The macOS binary must be an .app bundle: ${resolved}`);
  }
  return resolved;
}
