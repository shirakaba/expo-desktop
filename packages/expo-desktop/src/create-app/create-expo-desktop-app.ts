import { log } from "@clack/prompts";
import { type } from "arktype";
import { cyan, green, yellow } from "kleur/colors";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { AppJson, PackageJson } from "../common/app-json.ts";
import { applyConfigPlugins } from "../common/apply-config-plugins.ts";
import { makePrettySummary } from "../common/arktype.ts";
import { promisifiedSpawn } from "../common/child-process.ts";
import { title } from "../common/clack.ts";
import { packageManagerExec } from "../common/npm.ts";

/**
 * A crude switch to use to help with local development.
 *
 * - Installs the local copy of expo-desktop-config-plugins rather than pinning
 *   to a published release.
 * - Adds the apply-config-plugins.mjs script.
 */
const localDev = false;

export async function createExpoDesktopApp({
  name,
  packageManager,
  versions,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm";
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const { projectPath } = await createExpoApp({ name, packageManager, versions });

  title("Altering app.json…", { spacing: 1 });
  await updateAppJson({ name, projectPath });

  title("Altering package.json…", { spacing: 1 });
  const { name: packageJsonName } = await updatePackageJson({
    name,
    projectPath,
    versions,
    task: { type: "create" },
  });

  title("Installing dependencies…", { spacing: 1 });
  await npmInstall({ cwd: projectPath, packageManager });

  title("Adding the Windows app…", { spacing: 1 });
  await addDesktopApp({ cwd: projectPath, name, packageManager, type: "windows", versions });

  title("Adding the macOS app…", { spacing: 1 });
  await updatePackageJson({ name, projectPath, versions, task: { type: "pre-init-macos" } });
  await addDesktopApp({ cwd: projectPath, name, packageManager, type: "macos", versions });
  await updatePackageJson({
    name,
    projectPath,
    versions,
    task: { type: "post-init-macos", name: packageJsonName },
  });

  title("Running Expo Prebuild for the mobile apps…", { spacing: 1 });
  await runPrebuildMobile({ packageManager, projectPath });

  // TODO: Run Prebuild for macOS (once we've invented it)

  title("Improving the macOS app's gitignore file…", { spacing: 1 });
  await improveMacosGitignore({ projectPath });

  title("Adding Expo support to the macOS Podfile…", { spacing: 1 });
  await updatePodfile({ projectPath });

  // title("Installing Cocoapods for the iOS app…", { spacing: 1 });
  // await podInstall({ projectPath, type: "ios" });

  title("Installing Cocoapods for the macOS app…", { spacing: 1 });
  await podInstall({ projectPath, type: "macos" });

  title("Adding Expo support to the Metro config…", { spacing: 1 });
  await improveMetroConfig({ projectPath });

  title("Adding Expo support to the Babel config…", { spacing: 1 });
  await writeBabelConfig({ projectPath });

  title("Applying config plugins to macOS and Windows projects…", { spacing: 1 });
  if (localDev) {
    await addApplyConfigPluginsScript({ projectPath });
  }
  await applyConfigPlugins({
    projectRoot: projectPath,
    displayName: name.displayName,
    bundleIdentifier: name.rdns.replaceAll("_", "-"),
    // @ts-expect-error Normally only accepts ios and android
    platforms: ["macos", "windows"],
  });
  console.log(`${green("◆")}  Applied config plugins.\n`);

  // TODO: Set up Windows app.cpp entrypoint
}

async function createExpoApp({
  name,
  packageManager,
  versions,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm";
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const command = packageManager;
  const args = [
    "create",
    "expo-app",
    name.filesafeName,
    "--template",
    `blank-typescript@${versions.expoBlankTypeScript}`,
    "--no-install",
  ];

  console.log(`${cyan("◆")}  Running: ${yellow(`${command} ${args.join(" ")}`)}\n`);

  try {
    await promisifiedSpawn({ command, args, options: { stdio: "inherit" } });
  } catch (error) {
    log.error(
      `Error running ${yellow("create expo-app")}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  const projectPath = path.resolve(process.cwd(), name.filesafeName);

  return { projectPath };
}

async function updateAppJson({
  name,
  projectPath,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  projectPath: string;
}) {
  const appJsonPath = path.resolve(projectPath, "app.json");

  let appJson: ReturnType<typeof AppJson>;
  try {
    const contents = await fs.readFile(appJsonPath, "utf-8");
    appJson = AppJson(JSON.parse(contents));
  } catch (cause) {
    throw new Error(`Error reading ${yellow("app.json")}`, { cause });
  }

  if (appJson instanceof type.errors) {
    throw new Error(`Invalid config:\n${makePrettySummary(appJson).join("\n")}`);
  }

  if (!appJson.expo) {
    throw new Error(
      `Expected create expo-app to pre-populate the 'expo' field in app.json, but it was empty.`,
    );
  }

  // Try to preserve order.
  appJson.expo.name = name.filesafeName;
  appJson.expo.slug = name.filesafeName;
  if (!appJson.expo.ios) {
    appJson.expo.ios = {};
  }
  appJson.expo.ios.bundleIdentifier = name.rdns.replaceAll("_", "-");

  if (!appJson.expo.macos) {
    appJson.expo.macos = {};
  }
  appJson.expo.macos.bundleIdentifier = name.rdns.replaceAll("_", "-");

  if (!appJson.expo.android) {
    appJson.expo.android = {};
  }
  appJson.expo.android.package = name.rdns.replaceAll("-", "_");

  if (!appJson.expo.plugins) {
    appJson.expo.plugins = [];
  }
  appJson.expo.plugins = [
    ...appJson.expo.plugins,
    [
      "expo-desktop-config-plugins",
      // These props, which feed withDisplayName(), may seem redundant since we
      // now apply withMacosExpoPlugins(), but withDisplayName() goes a bit
      // further (e.g. setting the window title).
      {
        displayName: name.displayName,
        bundleIdentifier: name.rdns.replaceAll("_", "-"),
      },
    ],
  ];

  try {
    await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2), "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("app.json")}`, { cause });
  }

  console.log(`${green("◆")}  Altered app.json.\n`);
}

async function updatePackageJson({
  name,
  projectPath,
  task,
  versions,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  projectPath: string;
  task:
    | { type: "create" }
    | { type: "pre-init-macos" }
    | { type: "post-init-macos"; name: string | undefined };
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const packageJsonPath = path.resolve(projectPath, "package.json");

  let packageJson: ReturnType<typeof PackageJson>;
  try {
    const contents = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = PackageJson(JSON.parse(contents));
  } catch (cause) {
    throw new Error(`Error reading ${yellow("package.json")}`, { cause });
  }

  if (packageJson instanceof type.errors) {
    throw new Error(`Invalid config:\n${makePrettySummary(packageJson).join("\n")}`);
  }

  const nameBefore = packageJson.name;

  if (task.type === "pre-init-macos") {
    // create-expo-app shifts this to lowercase as per package.json rules, and
    // then react-native-macos-init maddeningly uses it in preference over the
    // app.json "name" value.
    // https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native-macos-init/src/cli.ts#L74-L75
    //
    // If only the underlying generateMacOS() / copyProjectTemplateAndReplace()
    // were exposed, we could just pass the name needed.
    // https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native-macos-init/src/cli.ts#L398
    // https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native/local-cli/generate-macos.js#L18
    //
    // But as it's not, our best option is to just write an invalid name into
    // the package.json temporarily (or remove it altogether). We'll set it
    // back to lower case later in the "restore-name" task.
    packageJson.name = name.filesafeName;
  } else if (task.type === "post-init-macos") {
    if (task.name) {
      packageJson.name = task.name;
    } else {
      delete packageJson.name;
    }

    // The windows init overwrites our scripts, so the best time to set them is
    // now (as post-init-macos runs after both windows and macos have been
    // initialised).
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    packageJson.scripts.macos = "rnc-cli run-macos";
    packageJson.scripts.windows = "rnc-cli run-windows";
  } else {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    if (localDev) {
      packageJson.dependencies["expo-desktop-config-plugins"] =
        "file:../../expo-desktop-config-plugins";
    } else {
      packageJson.dependencies["expo-desktop-config-plugins"] = "^1.1.10";
    }

    packageJson.dependencies["react-native-macos"] = versions.macos;
    packageJson.dependencies["react-native-windows"] = versions.windows;

    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
    packageJson.devDependencies["@react-native-community/cli"] = "latest";
    packageJson.devDependencies["@rnx-kit/metro-config"] = "latest";
    packageJson.devDependencies["@react-native/metro-config"] = `~0.${versions.minor}`;
  }

  try {
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("package.json")}`, { cause });
  }

  console.log(`${green("◆")}  Altered package.json.\n`);

  return { name: nameBefore };
}

async function npmInstall({
  cwd,
  packageManager,
}: {
  cwd?: string;
  packageManager: "npm" | "bun" | "pnpm";
}) {
  const command = packageManager;
  const args = ["install"];

  console.log(`${cyan("◆")}  Running: ${yellow(`${command} ${args.join(" ")}`)}\n`);

  try {
    await promisifiedSpawn({ command, args, options: { cwd, stdio: "inherit" } });
  } catch (error) {
    log.error(
      `Error running ${yellow(`${packageManager} install`)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Installed dependencies.\n`);
}

async function addDesktopApp({
  name,
  packageManager,
  versions,
  type,
  cwd,
}: {
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm";
  type: "macos" | "windows";
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
  cwd?: string;
}) {
  const { args, command } = packageManagerExec(packageManager);

  switch (type) {
    case "macos":
      args.push("react-native-macos-init", "--version", versions.macos);
      break;
    case "windows":
      args.push(
        "react-native",
        "init-windows",
        "--template",
        "cpp-app",
        "--namespace",
        name.rdns.replaceAll(/[-_]/g, ""),
        "--name",
        name.filesafeName,
      );
      break;
  }

  const printedCommand = `${command} ${args.join(" ")}`;
  console.log(`${cyan("◆")}  Running: ${yellow(printedCommand)}\n`);

  try {
    await promisifiedSpawn({ command, args, options: { cwd, stdio: "inherit" } });
  } catch (error) {
    log.error(
      `Error running ${yellow(printedCommand)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`${green("◆")}  Added ${yellow(type)} app.\n`);
}

async function runPrebuildMobile({
  packageManager,
  projectPath,
}: {
  packageManager: "npm" | "bun" | "pnpm";
  projectPath: string;
}) {
  const { args, command } = packageManagerExec(packageManager);

  args.push("expo", "prebuild", "--no-install");

  const printedCommand = `${command} ${args.join(" ")}`;
  console.log(`${cyan("◆")}  Running: ${yellow(printedCommand)}\n`);

  try {
    await promisifiedSpawn({
      command,
      args,
      options: { cwd: projectPath, stdio: "inherit" },
    });
  } catch (error) {
    log.error(
      `Error running ${yellow(printedCommand)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Ran Expo Prebuild for the mobile apps.\n`);
}

async function improveMacosGitignore({ projectPath }: { projectPath: string }) {
  const macosGitignorePath = path.resolve(projectPath, "macos/.gitignore");

  console.log(`${cyan("◆")}  Overwriting macos/.gitignore…\n`);

  try {
    await fs.writeFile(
      macosGitignorePath,
      `
# OSX
#
.DS_Store

# Xcode
#
build/
*.pbxuser
!default.pbxuser
*.mode1v3
!default.mode1v3
*.mode2v3
!default.mode2v3
*.perspectivev3
!default.perspectivev3
xcuserdata
*.xccheckout
*.moved-aside
DerivedData
*.hmap
*.ipa
*.xcuserstate
project.xcworkspace
.xcode.env.local

# Bundle artifacts
*.jsbundle

# CocoaPods
/Pods/
    `.trim() + "\n",
      "utf-8",
    );
  } catch (error) {
    log.error(
      `Error improving ${yellow("macos/.gitignore")} file${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Overwrote macos/.gitignore.\n`);
}

async function podInstall({ projectPath, type }: { projectPath: string; type: "ios" | "macos" }) {
  const command = "pod";
  const args = ["install"];

  const printedCommand = `${command} ${args.join(" ")}`;
  console.log(`${cyan("◆")}  Running: ${yellow(printedCommand)}\n`);

  try {
    await promisifiedSpawn({
      command,
      args,
      options: { cwd: path.resolve(projectPath, type), stdio: "inherit" },
    });
  } catch (error) {
    log.error(
      `Error running ${yellow(printedCommand)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(
    `\n${green("◆")}  Installed Cocoapods for the ${type === "ios" ? "iOS" : "macOS"} app.\n`,
  );
}

async function improveMetroConfig({ projectPath }: { projectPath: string }) {
  const metroConfigPath = path.resolve(projectPath, "metro.config.js");

  console.log(`${cyan("◆")}  Overwriting metro.config.js…\n`);

  try {
    await fs.writeFile(
      metroConfigPath,
      `
const { getDefaultConfig } = require("@expo/metro-config");
const { makeMetroConfig } = require("@rnx-kit/metro-config");

const config = makeMetroConfig(getDefaultConfig(__dirname));
module.exports = config;
    `.trim() + "\n",
      "utf-8",
    );
  } catch (error) {
    log.error(
      `Error improving ${yellow("metro.config.js")} file${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Overwrote metro.config.js.\n`);
}

async function updatePodfile({ projectPath }: { projectPath: string }) {
  const appJsonPath = path.resolve(projectPath, "macos/Podfile");

  let contents: string;
  try {
    contents = await fs.readFile(appJsonPath, "utf-8");
  } catch (cause) {
    throw new Error(`Error reading ${yellow("macos/Podfile")}`, { cause });
  }

  contents = [
    `require File.join(File.dirname(\`node --print "require.resolve('expo/package.json')"\`), "scripts/autolinking")`,
    contents,
  ].join("\n");

  contents = contents.replace(
    /  (?:config = )?use_native_modules!/,
    "  " +
      `
  use_expo_modules!

  config_command = [
    'npx',
    'expo-modules-autolinking',
    'react-native-config',
    '--json',
    '--platform',
    'ios'
  ]
  config = use_native_modules!(config_command)
    `.trim(),
  );

  contents = contents.replace(
    ":path => '../node_modules/react-native-macos',",
    ':path => "#{config[:reactNativePath]}-macos",',
  );

  contents = contents.replace(
    "react_native_post_install(installer)",
    "    " +
      `
    react_native_post_install(installer)

    # Fix for Xcode 26.4 build error
    # https://stackoverflow.com/a/79921410/5951226
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
    `.trim(),
  );

  try {
    await fs.writeFile(appJsonPath, contents, "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("macos/Podfile")}`, { cause });
  }

  console.log(`${green("◆")}  Altered macos/Podfile.\n`);
}

async function writeBabelConfig({ projectPath }: { projectPath: string }) {
  const babelConfigPath = path.resolve(projectPath, "babel.config.js");

  console.log(`${cyan("◆")}  Writing babel.config.js…\n`);

  try {
    await fs.writeFile(
      babelConfigPath,
      `
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
  };
};
    `.trim() + "\n",
      "utf-8",
    );
  } catch (error) {
    log.error(
      `Error improving ${yellow("babel.config.js")} file${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Wrote babel.config.js.\n`);
}

/**
 * For now, this is just a convenience script to allow me to run the config
 * plugins again after creating the app, to help with development. But it is
 * basically 80% of what Prebuild does, so we may end up adapting it and
 * shipping it for users in the end.
 */
async function addApplyConfigPluginsScript({ projectPath }: { projectPath: string }) {
  await fs.writeFile(
    path.resolve(projectPath, "apply-config-plugins.mjs"),
    `
import { createRequire } from "node:module";
import * as path from "node:path";

const require = createRequire(import.meta.url);
const { getPrebuildConfigAsync } = require("expo-desktop-prebuild-config");
const { compileModsAsync } = require("expo-desktop-config-plugins");

const projectRoot = import.meta.dirname;

const info = {
  projectRoot,
  displayName: "My Display Name",
  bundleIdentifier: "com.example.my-app-123",
  // @ts-expect-error Normally only accepts ios and android
  platforms: ["macos", "windows"],
};

const withInternal = (config, internals) => {
  config._internal = {
    isDebug: false,
    ...config._internal,
    ...internals,
  };
  return config;
};

/**
 * Applies config plugins.
 * @see https://github.com/microsoft/react-native-test-app/blob/trunk/packages/app/scripts/config-plugins/apply.mjs
 */
async function applyConfigPlugins(options) {
  const { projectRoot } = options;

  // To avoid making expo-desktop depend on Expo SDK 54 when we might be running
  // on an Expo 55 project, we import Expo deps from the project itself.
  /** @type {typeof import("@expo/config")} */
  let expoConfigModule;
  try {
    expoConfigModule = await import(
      path.dirname(require.resolve("@expo/config/package.json", { paths: [projectRoot] }))
    );
  } catch (cause) {
    throw new Error(
      \`Error importing "@expo/config" relative to projectRoot "\${projectRoot}". Make sure to install node modules before running any prebuilds, and make sure that the project depends on the package named "expo".\`,
      { cause },
    );
  }
  const { getConfig } = expoConfigModule;

  /** @type {typeof import("@expo/config-plugins")} */
  let expoConfigPluginsModule;
  try {
    expoConfigPluginsModule = await import(
      path.dirname(require.resolve("@expo/config-plugins/package.json", { paths: [projectRoot] }))
    );
  } catch (cause) {
    throw new Error(
      \`Error importing "@expo/config-plugins" relative to projectRoot "\${projectRoot}". Make sure to install node modules before running any prebuilds, and make sure that the project depends on the package named "expo".\`,
      { cause },
    );
  }
  const { withPlugins } = expoConfigPluginsModule;

  // (1) Filter out platforms that aren't in the app.json.
  // https://github.com/expo/expo/blob/8dd645080f52927e2a8bf406167da7241a1d46d8/packages/%40expo/cli/src/prebuild/prebuildAsync.ts#L74
  let { exp: expoConfig } = getConfig(projectRoot);
  const { platforms, plugins } = expoConfig;
  if (platforms?.length) {
    const finalPlatforms = options.platforms.filter((platform) => platforms.includes(platform));
    if (finalPlatforms.length > 0) {
      options.platforms = finalPlatforms;
    } else {
      const requestedPlatforms = options.platforms.join(", ");
      console.warn(
        \`⚠️  Requested prebuild for "\${requestedPlatforms}", but only "\${platforms.join(", ")}" is present in app config ("expo.platforms" entry). Continuing with "\${requestedPlatforms}".\`,
      );
    }
  }

  const prebuildConfig = await getPrebuildConfigAsync(projectRoot, options);
  expoConfig = prebuildConfig.exp;

  return compileModsAsync(
    withPlugins(withInternal(expoConfig, options), plugins),
    options,
  );
}

await applyConfigPlugins(info);
    `.trim() + "\n",
    "utf-8",
  );
}
