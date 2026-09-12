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
import { ensureNativeProjectAsync } from "./ensureNativeProject.ts";
import {
  resolveBuildCache,
  uploadBuildCache,
} from "./expo/build-cache-providers/build-cache-providers.ts";
import { exportEagerAsync } from "./expo/exportEager.ts";
import { getSchemesForMacosAsync } from "./expo/scheme.ts";
import { getLaunchInfoForBinaryAsync, launchAppAsync } from "./launchApp.ts";
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

  if (props.device) {
    Log.log(`› Using ${props.device.name}`);
  }

  if (!options.binary && props.buildCacheProvider) {
    const localPath = await resolveBuildCache({
      projectRoot,
      platform: "macos",
      runOptions: options,
      provider: props.buildCacheProvider,
    });
    if (localPath) {
      options.binary = localPath;
    }
  }

  if (options.rebundle) {
    throw new Error("expo-desktop does not currently support the --unstable-rebundle option.");
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

  // Start the dev server which creates all of the required info for
  // launching the app on the host device.
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
      runOptions: options,
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

/** Copy the built binary to the specified output directory. */
async function copyBinaryToOutputAsync(binaryPath: string, outputDir: string): Promise<string> {
  const absoluteOutputDir = path.resolve(outputDir);
  const appName = path.basename(binaryPath);
  const outputPath = path.join(absoluteOutputDir, appName);

  // Create the output directory if it doesn't exist.
  await fs.promises.mkdir(absoluteOutputDir, { recursive: true });

  // Copy the .app bundle to the output directory.
  await fs.promises.cp(binaryPath, outputPath, { recursive: true });

  Log.log(chalk`{dim Copied to} ${outputPath}`);

  return outputPath;
}
