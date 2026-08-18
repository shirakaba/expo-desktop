import { log } from "@clack/prompts";
import { getConfig } from "@expo/config";
import chalk from "chalk";
import Debug from "debug";
import { default as kleur } from "kleur";

import { setupDependenciesAsync } from "../common/expo/create-async-utils.ts";
import { env } from "../common/expo/env.ts";
import { Log } from "../common/expo/log.ts";
import { clearNodeModulesAsync } from "../common/expo/node-modules.ts";
import { logNewSection } from "../common/expo/ora.ts";
import { confirmAsync } from "../common/expo/prompts-cli.ts";
import { loadEnvFiles, setNodeEnv } from "../common/node-env.ts";
import { ensureConfigAsync } from "./ensure-config-async.ts";
import { clearNativeFolder } from "./expo/clear-native-folder.ts";
import { promptToClearMalformedNativeProjectsAsync } from "./expo/clear-native-folder.ts";
import { configureProjectAsync } from "./expo/configure-project-async.ts";
import { updateXcodeProject } from "./expo/inline-modules.ts";
import {
  assertPlatforms,
  ensureValidPlatforms,
  resolvePackageManagerOptions,
  resolveSkipDependencyUpdate,
  resolveTemplateOption,
} from "./expo/resolve-options.ts";
import { updateFromTemplateAsync } from "./update-from-template-async.ts";

const debug = Debug("expo-desktop:prebuild:command") as typeof console.log;

/**
 * The entrypoint for `npx expo prebuild` is here:
 * [@expo/cli/src/prebuild/index.ts] expoPrebuild() >
 * [@expo/cli/src/prebuild/configureProjectAsync.ts] configureProjectAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfigAsync() >
 * [@expo/prebuild-config/src/getPrebuildConfig.ts] getPrebuildConfig() >
 * [@expo/prebuild-config/src/plugins/withDefaultPlugins.ts] withIosExpoPlugins()
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/index.ts#L7
 * @see https://github.com/expo/expo/blob/15d35298c9a397c23bcbf6b20e2b9761564acbc4/packages/%40expo/cli/src/prebuild/configureProjectAsync.ts#L37
 */
export async function prebuild(args: {
  clean: boolean | undefined;
  "no-install": boolean | undefined;
  npm: boolean | undefined;
  yarn: boolean | undefined;
  bun: boolean | undefined;
  pnpm: boolean | undefined;
  template: string | undefined;
  platform: string | undefined;
  "skip-dependency-update": boolean | undefined;
}) {
  const options: typeof args & {
    noInstall: boolean | undefined;
    install: boolean;
    skipDependencyUpdate: boolean | undefined;
  } = {
    clean: args.clean,
    noInstall: args["no-install"],
    ["no-install"]: args["no-install"],
    npm: args.npm,
    yarn: args.yarn,
    bun: args.bun,
    pnpm: args.pnpm,
    template: args.template,
    platform: args.platform,
    ["skip-dependency-update"]: args["skip-dependency-update"],
    skipDependencyUpdate: args["skip-dependency-update"],
    install: !args["no-install"],
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop prebuild")}.`, { withGuide: false });

  let platforms = resolvePlatformsOption(options.platform);
  const projectRoot = process.cwd();

  setNodeEnv("development");
  loadEnvFiles(projectRoot);

  // Filter out platforms that aren't in the app.json.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L74
  const { exp: expoConfig } = getConfig(projectRoot);
  if (expoConfig.platforms?.length) {
    const finalPlatforms = platforms.filter((platform) =>
      (expoConfig.platforms as Array<"ios" | "android" | "web" | "macos" | "windows">).includes(
        platform,
      ),
    );
    if (finalPlatforms.length > 0) {
      platforms = finalPlatforms;
    } else {
      const requestedPlatforms = platforms.join(", ");
      console.warn(
        `⚠️  Requested prebuild for "${requestedPlatforms}", but only "${expoConfig.platforms.join(", ")}" is present in app config ("expo.platforms" entry). Continuing with "${requestedPlatforms}".`,
      );
    }
  }

  if (options.clean) {
    const { maybeBailOnGitStatusAsync } = await import("../common/expo/git-cli.ts");
    // Clean the project folders...
    if (await maybeBailOnGitStatusAsync()) {
      return null;
    }

    // Skipping: maybeBailOnNativeModuleAsync()
    // (as it depends on the "expo" npm package and is no longer important after
    // SDK 56)

    // Clear the native folders before syncing
    await clearNativeFolder(projectRoot, platforms);
  } else {
    // Check if the existing project folders are malformed.
    await promptToClearMalformedNativeProjectsAsync(projectRoot, platforms);
  }

  // Warn if the project is attempting to prebuild an unsupported platform (iOS on Windows).
  platforms = ensureValidPlatforms(platforms);
  // Assert if no platforms are left over after filtering.
  assertPlatforms(platforms);

  const { exp, pkg } = await ensureConfigAsync(projectRoot, { platforms });

  // Create native projects from template.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L112-L120
  // https://github.com/expo/expo/blob/e2aa8935077d88fbbb22b1f4dc1f8a1586080b97/packages/%40expo/cli/src/prebuild/updateFromTemplate.ts#L23
  const {
    hasNewProjectFiles,
    needsPodInstallIos,
    needsPodInstallMacos,
    templateChecksum,
    changedDependencies,
  } = await updateFromTemplateAsync(projectRoot, {
    exp,
    pkg,
    template: options.template != null ? resolveTemplateOption(options.template) : undefined,
    platforms,
    skipDependencyUpdate: resolveSkipDependencyUpdate(options.skipDependencyUpdate),
  });

  // Install node modules
  if (options.install) {
    // Validate options
    resolvePackageManagerOptions({
      noInstall: options.noInstall,
      npm: options.npm,
      yarn: options.yarn,
      bun: options.bun,
      pnpm: options.pnpm,
    });

    if (changedDependencies.length) {
      if (options.npm) {
        await clearNodeModulesAsync(projectRoot);
      }

      Log.log(chalk.gray(chalk`Dependencies in the {bold package.json} changed:`));
      Log.log(chalk.gray("  " + changedDependencies.join(", ")));

      // Installing dependencies is a legacy feature from the unversioned
      // command. We know opt to not change dependencies unless a template
      // indicates a new dependency is required, or if the core dependencies are wrong.
      if (
        await confirmAsync({
          message: `Install the updated dependencies?`,
          initial: true,
        })
      ) {
        // The real Expo CLI effectively runs `expo install` here. However,
        // that's a very deep rabbit hole to port to Expo Desktop, and in this
        // case really doesn't offer much value over setupDependenciesAsync().

        // await installAsync([], {
        //   npm: !!options.npm,
        //   yarn: !!options.yarn,
        //   pnpm: !!options.pnpm,
        //   bun: !!options.bun,
        //   silent: !(env.EXPO_DEBUG || env.CI),
        // });

        await setupDependenciesAsync(projectRoot, { install: true });
      }
    }
  }

  // Apply Expo config to native projects. Prevent log-spew from ora when running in debug mode.
  const configSyncingStep: { succeed(text?: string): unknown; fail(text?: string): unknown } =
    env.EXPO_DEBUG
      ? {
          succeed(text) {
            Log.log(text!);
          },
          fail(text) {
            Log.error(text!);
          },
        }
      : logNewSection("Running prebuild");
  try {
    await configureProjectAsync(projectRoot, {
      platforms,
      exp,
      templateChecksum,
    });
    configSyncingStep.succeed("Finished prebuild");
  } catch (error) {
    configSyncingStep.fail("Prebuild failed");
    throw error;
  }

  // Install CocoaPods
  let podsInstalledIos: boolean = false;
  let podsInstalledMacos: boolean = false;

  const shouldPodInstallForIos = platforms.includes("ios") && options.install && needsPodInstallIos;
  const shouldPodInstallForMacos =
    platforms.includes("macos") && options.install && needsPodInstallMacos;

  // err towards running pod install less because it's slow and users can easily
  // run npx pod-install afterwards.
  if (shouldPodInstallForIos || shouldPodInstallForMacos) {
    const { installCocoaPodsAsync } = await import("../common/expo/cocoapods.ts");

    if (shouldPodInstallForIos) {
      podsInstalledIos = await installCocoaPodsAsync(projectRoot, "ios");
    }
    if (shouldPodInstallForMacos) {
      podsInstalledMacos = await installCocoaPodsAsync(projectRoot, "macos");
    }
  } else {
    debug("Skipped pod install");
  }

  const inlineModules = exp.experiments?.inlineModules ?? false;
  if (inlineModules) {
    const watchedDirectories = inlineModules.watchedDirectories ?? [];
    if (platforms.includes("ios")) {
      await updateXcodeProject({
        projectRoot,
        inlineModulesXcodeParams: { platform: "ios", watchedDirectories },
      });
    }
    if (platforms.includes("macos")) {
      await updateXcodeProject({
        projectRoot,
        inlineModulesXcodeParams: { platform: "macos", watchedDirectories },
      });
    }
  }

  return {
    nodeInstall: !!options.install,
    podInstall: !(podsInstalledIos || podsInstalledMacos),
    platforms: platforms,
    hasNewProjectFiles,
    exp,
  };
}

function resolvePlatformsOption(
  platform: string | undefined,
): Array<"ios" | "android" | "macos" | "windows"> {
  if (
    platform !== "ios" &&
    platform !== "android" &&
    platform !== "mobile" &&
    platform !== "macos" &&
    platform !== "windows" &&
    platform !== "desktop" &&
    platform !== "all" &&
    typeof platform !== "undefined"
  ) {
    throw new Error(
      "Expected --platform arg to be one of: ios | android | mobile | macos | windows | desktop | all | <undefined>",
    );
  }

  const platforms = new Array<"ios" | "android" | "macos" | "windows">();
  if (platform === "all" || platform === "mobile" || platform === "ios") {
    platforms.push("ios");
  }
  if (platform === "all" || platform === "mobile" || platform === "android") {
    platforms.push("android");
  }
  if (platform === "all" || platform === "desktop" || platform === "macos") {
    platforms.push("macos");
  }
  if (platform === "all" || platform === "desktop" || platform === "windows") {
    platforms.push("windows");
  }
  if (!platforms.length) {
    platforms.push("ios", "android", "macos", "windows");
  }

  return platforms;
}
