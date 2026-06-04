import type { ModPlatform } from "@expo/config-plugins";

import { log, tasks } from "@clack/prompts";
import { type } from "arktype";
import { glob } from "glob";
import { cyan, green, yellow } from "kleur/colors";
import fs from "node:fs/promises";
import path from "node:path";
import { platform } from "node:process";
import process from "node:process";

import { AppJson, PackageJson } from "../common/app-json.ts";
import { applyConfigPlugins } from "../common/apply-config-plugins.ts";
import { makePrettySummary } from "../common/arktype.ts";
import { promisifiedSpawnTask, SPAWN_DEBUG_LOG_GLOB } from "../common/child-process.ts";
import { title } from "../common/clack.ts";
import { hasGitStagedChangesAsync, hasProjectGitRepositoryAsync } from "../common/git.ts";
import { packageManagerExec } from "../common/npm.ts";
import { preserveFile } from "../common/preserve-file.ts";
import { applySelectedTemplatesAsync, type TemplateSelection } from "../common/template.ts";

export async function createExpoDesktopApp({
  localDev,
  name,
  packageManager,
  templates,
  versions,
}: {
  /**
   * A crude switch to use to help with local development.
   *
   * - Skips the questionnaire at the start.
   * - Installs the local copy of expo-desktop-config-plugins rather than pinning
   *   to a published release.
   * - Adds the apply-config-plugins.mjs script.
   */
  localDev?: boolean | undefined;
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  templates: TemplateSelection;
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  const { projectPath } = await createExpoApp({ localDev, name, packageManager, versions });
  await appendRootGitignoreSpawnDebugLogs(projectPath);

  const templateSelection = {
    // https://github.com/expo/expo/blob/sdk-54/templates/expo-template-blank-typescript
    template: templates.template,
    "template-ios": templates["template-ios"],
    "template-android": templates["template-android"],
    // https://github.com/microsoft/react-native-macos/tree/main/packages/react-native/local-cli/generator-macos/templates/macos
    "template-macos":
      templates["template-macos"] ??
      "microsoft/react-native-macos#main:packages/react-native/local-cli/generator-macos/templates",
    // https://github.com/microsoft/react-native-windows/tree/main/vnext/templates/cpp-app
    "template-windows":
      templates["template-windows"] ??
      "microsoft/react-native-windows#main:vnext/templates/cpp-app",
  } satisfies TemplateSelection;

  title("Applying templates…", { spacing: 1 });
  await applySelectedTemplatesAsync({
    projectRoot: projectPath,
    selection: templateSelection,
    enabledPlatforms: ["ios", "android", "macos", "windows"],
    name,
    // I had originally hoped to consume the template.config.js file provided by
    // the template, but the prototype in cpp-app imports dependencies like
    // "chalk", "lodash", "username", and "../templateUtils" that it doesn't
    // declare in any package.json, so we can't reliably support it. Will
    // revisit the idea in future.
    respectTemplateConfig: false,
  });
  console.log(`${green("◆")}  Applied templates.\n`);

  title("Altering app.json…", { spacing: 1 });
  await updateAppJson({ name, projectPath });

  title("Altering package.json…", { spacing: 1 });
  const { name: packageJsonName } = await updatePackageJson({
    localDev,
    name,
    projectPath,
    versions,
    task: { type: "create" },
  });

  title("Installing dependencies…", { spacing: 1 });
  await npmInstall({ asNewWorkspace: true, cwd: projectPath, packageManager });

  await updatePackageJson({
    name,
    projectPath,
    versions,
    task: { type: "post-init-macos", name: packageJsonName },
  });

  title("Running Expo Prebuild for the mobile apps…", { spacing: 1 });
  await runPrebuildMobile({ packageManager, projectPath });

  title("Running Expo Desktop Prebuild for the desktop apps…", { spacing: 1 });
  if (localDev) {
    await addApplyConfigPluginsScript({ projectPath });
  }
  const bundleEntryFileCandidates = await getBundleEntryFileCandidates({ projectPath });
  await applyConfigPlugins({
    projectRoot: projectPath,
    displayName: name.displayName,
    bundleIdentifier: name.rdns.replaceAll("_", "-"),
    platforms: ["macos", "windows"] as unknown as Array<ModPlatform>,
    bundleEntryFileCandidates,
  });
  console.log(`${green("◆")}  Applied config plugins.\n`);

  title("Improving the macOS app's gitignore file…", { spacing: 1 });
  await improveMacosGitignore({ projectPath });

  title("Adding Expo support to the macOS Podfile…", { spacing: 1 });
  await updatePodfile({ projectPath });

  if (platform === "darwin") {
    // Avoid having to wait a million years for Hermes to download when focusing
    // on developing desktop
    if (!localDev) {
      title("Installing Cocoapods for the iOS app…", { spacing: 1 });
      await podInstall({ projectPath, type: "ios" });
    }

    title("Installing Cocoapods for the macOS app…", { spacing: 1 });
    await podInstall({ projectPath, type: "macos" });
  }

  // react-native config seems to return `windows: null` on non-Windows
  // platforms (while returning a populated object for Windows). If you force it
  // to non-null for development on macOS, macOS runs the autolinking command
  // successfully but writes out erroneous output, so
  // there's no point.
  if (platform === "win32") {
    title("Autolinking the Windows app…", { spacing: 1 });
    await autolinkWindows({ projectPath });
  }

  title("Adding Expo support to the Metro config…", { spacing: 1 });
  await improveMetroConfig({ projectPath });

  title("Adding Expo support to the Babel config…", { spacing: 1 });
  await writeBabelConfig({ projectPath });

  title("Improving App.tsx…", { spacing: 1 });
  await improveAppTsx({ projectPath });

  title("Committing changes…", { spacing: 1 });
  await commitChanges({ projectPath });

  logProjectReady({ cdPath: name.filesafeName, packageManager });
}

async function getBundleEntryFileCandidates({ projectPath }: { projectPath: string }) {
  try {
    // Seems to order candidates as:
    // [
    //   "index.windows.tsx",
    //   "index.windows.ts",
    //   "index.windows.jsx",
    //   "index.windows.js",
    //   "index.tsx",
    //   "index.ts",
    //   "index.jsx",
    //   "index.js",
    // ]
    const candidates = await glob("index?(.windows|.macos|.ios|.android|.native).{ts,tsx,js,jsx}", {
      cwd: projectPath,
    });

    return candidates;
  } catch (error) {
    console.warn(
      "Unable to detect an index?(.windows).{ts,tsx,js,jsx} file in the root of the project, so will fall back to a <BundleEntryFile> value to 'index.ts'.",
      error,
    );
    return ["index.ts"];
  }
}

async function createExpoApp({
  localDev,
  name,
  packageManager,
  versions,
}: {
  localDev?: boolean | undefined;
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  versions: {
    minor: number;
    expoMajor: number;
    expoBlankTypeScript: string;
    mobile: string;
    windows: string;
    macos: string;
  };
}) {
  // `create-expo-app` aggravatingly reconfigures your workspace to use
  // `nodeLinker: hoisted`, which sucks when creating sample projects inside
  // this monorepo during local dev (even with `--no-install`). So we fight
  // back.
  //
  // For non-local dev, it sounds like we can use `nodeLinker: isolated` as of
  // Expo SDK 54, so I'm tempted to enforce that in created templates, too. But
  // one thing at a time.
  // - https://docs.expo.dev/more/create-expo/#pnpm
  // - https://github.com/expo/expo/blob/222b3b12610d69784bab6c5a188a46ea388f866a/packages/create-expo/src/resolvePackageManager.ts#L109
  const gen = preserveFile({
    enable: localDev,
    filePath: localDev ? path.resolve(import.meta.dirname, "../../../../pnpm-workspace.yaml") : "",
  });
  await gen.next();

  // `npm create` drops flags meant for create-expo-app unless you add `--`; use
  // `npx --yes` instead to forward args correctly. Pass `--yes` to
  // create-expo-app for non-interactive template selection; set `CI=true` in the
  // child env so git-init inside an existing repo is skipped too.
  const command = packageManager === "npm" ? "npx" : packageManager;
  let packageManagerArgs = ["create", "expo-app@latest"];
  if (packageManager === "npm") packageManagerArgs = ["--yes", "create-expo-app@latest"];
  if (packageManager === "yarn") packageManagerArgs = ["create", "expo-app"];
  const args = [
    ...packageManagerArgs,
    name.filesafeName,
    "--yes",
    "--template",
    `blank-typescript@${versions.expoBlankTypeScript}`,
    "--no-install",
  ];

  console.log(`${cyan("◆")}  Running: ${yellow(`${command} ${args.join(" ")}`)}\n`);

  const projectPath = path.resolve(process.cwd(), name.filesafeName);
  try {
    await tasks([
      promisifiedSpawnTask({
        title: "create-expo-app",
        command,
        args,
        options: {
          stdio: "inherit",
          env: {
            // Suppresses npx/npm exec "Ok to proceed?" and similar yes/no prompts.
            npm_config_yes: "true",
            // create-expo-app's `--yes` skips template/SDK prompts but not the
            // "Skip initializing a new git repository?" confirm when cwd is
            // inside an existing repo; that path only auto-skips when CI is set.
            // https://github.com/expo/expo/blob/main/packages/create-expo/src/utils/git.ts
            CI: "true",
          },
        },
        debugLogDir: projectPath,
      }),
    ]);
  } catch (error) {
    log.error(
      `Error running ${yellow("create expo-app")}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  } finally {
    await gen.next();
  }

  return { projectPath };
}

async function appendRootGitignoreSpawnDebugLogs(projectPath: string) {
  const gitignorePath = path.join(projectPath, ".gitignore");
  let content = "";
  try {
    content = await fs.readFile(gitignorePath, "utf-8");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  if (content.includes(SPAWN_DEBUG_LOG_GLOB)) {
    return;
  }

  const block = `# expo-desktop child process debug logs\n${SPAWN_DEBUG_LOG_GLOB}\n`;
  const padding = content.length ? "\n" : "";
  await fs.appendFile(gitignorePath, `${padding}${block}`, "utf-8");
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
  appJson.expo.platforms = ["android", "ios", "macos", "windows"];
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
  localDev,
  name,
  projectPath,
  task,
  versions,
}: {
  localDev?: boolean | undefined;
  name: {
    displayName: string;
    filesafeName: string;
    rdns: string;
  };
  projectPath: string;
  task: { type: "create" } | { type: "post-init-macos"; name: string | undefined };
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

  if (task.type === "post-init-macos") {
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
    packageJson.scripts["autolink-windows"] = "react-native autolink-windows";
  } else {
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    const monorepoDeps = {
      // expo-desktop-prebuild-config itself depends on
      // expo-desktop-config-plugins.
      ["expo-desktop-prebuild-config"]: "^1.0.0",
      ["expo-desktop-modules-core"]: `^${versions.expoMajor}.0.0`,
      ["expo-desktop-stubs"]: `^${versions.expoMajor}.0.0`,
    };
    for (const [key, value] of Object.entries(monorepoDeps)) {
      // TODO: Try replacing this `localDev` logic with `linkWorkspacePackages`:
      // - https://pnpm.io/workspaces#linkworkspacepackages
      // - https://pnpm.io/workspaces#workspace-protocol-workspace
      packageJson.dependencies[key] = localDev ? `file:../../${key}` : value;
    }

    packageJson.dependencies["react-native-macos"] = versions.macos;
    packageJson.dependencies["react-native-windows"] = versions.windows;

    if (!packageJson.devDependencies) {
      packageJson.devDependencies = {};
    }
    packageJson.devDependencies["@react-native-community/cli"] = "latest";
    packageJson.devDependencies["@rnx-kit/metro-config"] = "latest";
    packageJson.devDependencies["@react-native/metro-config"] = `~0.${versions.minor}`;

    if (!packageJson.overrides) {
      packageJson.overrides = {};
    }

    // The "react" version in expo-template-blank-typescript for SDK 54 is
    // 19.1.0, but it needs to be 19.1.4 to satisfy react-native-macos and
    // react-native-windows. We find that the React Native HelloWorld template
    // is more reliable as a source of truth for the best "react" and
    // "react-native" versions to satisfy them, but it's still a best of a bad
    // job.
    let facebookDeps: { react: string; "react-native": string } | undefined;
    try {
      const packageJson = (await getReactNativePackageJson(versions.minor)) as ReturnType<
        JSON["parse"]
      >;
      facebookDeps = {
        react: packageJson.dependencies.react,
        "react-native": packageJson.dependencies["react-native"],
      };
    } catch (error) {
      // It's totally possible to get rate-limited by the GitHub API, so we'll
      // avoid failing the entire command just for a bad fetch here.
      console.warn(
        `Unable to get the ideal dependency versions for "react" and "react-native" from the official React Native HelloWorld template, so will use the ones from the Expo template as-is.`,
        error,
      );
    }

    if (facebookDeps) {
      packageJson.dependencies.react = facebookDeps.react;
      packageJson.overrides.react = facebookDeps.react;
      packageJson.dependencies["react-native"] = facebookDeps["react-native"];
      packageJson.overrides["react-native"] = facebookDeps["react-native"];
    } else {
      // react-native-macos and react-native-windows may declare conflicting
      // peer dependency ranges to what the Expo template provides.
      if (packageJson.dependencies.react) {
        packageJson.overrides.react = packageJson.dependencies.react;
      }
      if (packageJson.dependencies["react-native"]) {
        packageJson.overrides["react-native"] = packageJson.dependencies["react-native"];
      }
    }

    if (!packageJson.expo) {
      packageJson.expo = {};
    }
    if (!packageJson.expo.install) {
      packageJson.expo.install = {};
    }
    if (!packageJson.expo.install.exclude) {
      packageJson.expo.install.exclude = [];
    }

    // Stop `expo start` erroneously warning about our overrides.
    // - https://github.com/shirakaba/expo-desktop/issues/15
    // - https://docs.expo.dev/versions/latest/config/package-json/#installexclude
    if (!packageJson.expo.install.exclude.includes("react")) {
      packageJson.expo.install.exclude.push("react");
    }
    if (!packageJson.expo.install.exclude.includes("react-native")) {
      packageJson.expo.install.exclude.push("react-native");
    }
  }

  try {
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("package.json")}`, { cause });
  }

  console.log(`${green("◆")}  Altered package.json.\n`);

  return { name: nameBefore };
}

async function getReactNativePackageJson(minor: number) {
  const response = await fetch(
    `https://raw.githubusercontent.com/facebook/react-native/refs/heads/0.${minor}-stable/private/helloworld/package.json`,
  );
  return await response.json();
}

async function npmInstall({
  asNewWorkspace,
  cwd,
  packageManager,
}: {
  /** WIP monorepo awareness. */
  asNewWorkspace: boolean;
  cwd: string;
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
}) {
  const command = packageManager;
  const args = ["install"];

  console.log(`${cyan("◆")}  Running: ${yellow(`${command} ${args.join(" ")}`)}\n`);

  // Unlike npm and bun, pnpm climbs up to install dependencies in the closest
  // ancestor directory if there is one. This is particularly inconvenient
  // during local dev when we're creating samples inside the monorepo.
  if (asNewWorkspace && packageManager === "pnpm") {
    // (1) Ensure a file name pnpm-workspace.yaml exists.
    //
    // (2) Also ensure that it uses nodeLinker: hoisted, as otherwise
    // `:path => "#{config[:reactNativePath]}-macos"` predicts that there will
    // be a react-native-macos directory right beside the react-native
    // directory by just optimistically appending "-macos" on the end, like so:
    // "../node_modules/.pnpm/react-native@0.81.5_@babel+core@7.29.0_@react-native-community+cli@20.1.3_typescript@5._941d99d35895d1a3626e14fd9f3b3666/node_modules/react-native" + "-macos"
    //
    //     As this is not true with pnpm's default `nodeLinker: isolated`, we
    //     need to stick to `nodeLinker: hoisted` until we can rewrite the
    //     Podfile script to resolve it properly.
    //
    //     This is consistent with what the Expo team do for pnpm and yarn:
    //     - https://docs.expo.dev/more/create-expo/#pnpm
    //     - https://github.com/expo/expo/blob/222b3b12610d69784bab6c5a188a46ea388f866a/packages/create-expo/src/resolvePackageManager.ts#L109
    try {
      await fs.writeFile(path.resolve(cwd, "pnpm-workspace.yaml"), "nodeLinker: hoisted\n", {
        flag: "wx",
        encoding: "utf-8",
      });
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  try {
    await tasks([
      promisifiedSpawnTask({
        title: `${packageManager} install`,
        command,
        args,
        options: { cwd, stdio: "inherit" },
      }),
    ]);
  } catch (error) {
    log.error(
      `Error running ${yellow(`${packageManager} install`)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Installed dependencies.\n`);
}

async function runPrebuildMobile({
  packageManager,
  projectPath,
}: {
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
  projectPath: string;
}) {
  const { args, command } = packageManagerExec(packageManager);

  args.push("expo", "prebuild", "--no-install");

  const printedCommand = `${command} ${args.join(" ")}`;
  console.log(`${cyan("◆")}  Running: ${yellow(printedCommand)}\n`);

  try {
    await tasks([
      promisifiedSpawnTask({
        title: "expo prebuild (mobile)",
        command,
        args,
        options: { cwd: projectPath, stdio: "inherit" },
      }),
    ]);
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
    await tasks([
      promisifiedSpawnTask({
        title: `pod install (${type})`,
        command,
        args,
        options: { cwd: path.resolve(projectPath, type), stdio: "inherit" },
      }),
    ]);
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

async function autolinkWindows({ projectPath }: { projectPath: string }) {
  const command = "node";
  const args = ["--run", "autolink-windows"];

  const printedCommand = `${command} ${args.join(" ")}`;
  console.log(`${cyan("◆")}  Running: ${yellow(printedCommand)}\n`);

  try {
    await tasks([
      promisifiedSpawnTask({
        title: "react-native autolink-windows",
        command,
        args,
        options: { cwd: projectPath, stdio: "inherit" },
      }),
    ]);
  } catch (error) {
    log.error(
      `Error running ${yellow(printedCommand)}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Autolinked the Windows app.\n`);
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
 * Improve the App.tsx so that it's not white-on-white on macOS in dark mode.
 * Here, we simply ensure that it's black-on-white in both light and dark modes.
 *
 * @see https://github.com/shirakaba/expo-desktop/pull/14#issuecomment-4614018796
 * @see https://github.com/expo/expo/blob/sdk-54/templates/expo-template-blank-typescript/App.tsx
 */
async function improveAppTsx({ projectPath }: { projectPath: string }) {
  const metroConfigPath = path.resolve(projectPath, "App.tsx");

  console.log(`${cyan("◆")}  Overwriting App.tsx…\n`);

  try {
    await fs.writeFile(
      metroConfigPath,
      `
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#000',
  },
});
    `.trim() + "\n",
      "utf-8",
    );
  } catch (error) {
    log.error(
      `Error improving ${yellow("App.tsx")} file${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Overwrote App.tsx.\n`);
}

/**
 * Stage and commit all changes.
 *
 * @see https://github.com/expo/expo/blob/main/packages/create-expo/src/utils/git.ts
 */
async function commitChanges({ projectPath }: { projectPath: string }) {
  if (!(await hasProjectGitRepositoryAsync(projectPath))) {
    console.warn(
      `\n${yellow("⚠")}  Skipping git commit: create-expo-app did not initialize a Git repository in this project (this happens when creating inside an existing repo, e.g. in a monorepo).\n`,
    );
    return;
  }

  try {
    await tasks([
      promisifiedSpawnTask({
        title: "git add",
        command: "git",
        args: ["add", "-A"],
        options: { cwd: projectPath, stdio: "ignore" },
      }),
    ]);
  } catch (error) {
    log.error(
      `Error running ${yellow("git add -A")}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  if (!(await hasGitStagedChangesAsync(projectPath))) {
    console.log(`\n${green("◆")}  Nothing to commit.\n`);
    return;
  }

  try {
    await tasks([
      promisifiedSpawnTask({
        title: "git commit",
        command: "git",
        args: ["commit", "-m", "Set up with expo-desktop"],
        options: { cwd: projectPath, stdio: "ignore" },
      }),
    ]);
  } catch (error) {
    log.error(
      `Error running ${yellow("git commit")}${error instanceof Error ? `: ${error.message}` : "."}`,
    );
    process.exit(1);
  }

  console.log(`\n${green("◆")}  Committed changes.\n`);
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
import { globSync } from "node:fs";
import { createRequire } from "node:module";

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
  bundleEntryFileCandidates: getBundleEntryFileCandidates({ projectPath: projectRoot }),
};

function getBundleEntryFileCandidates({ projectPath }) {
  try {
    const candidates = globSync("index{.windows,.macos,.ios,.android,.native,}.{ts,tsx,js,jsx}", {
      cwd: projectPath,
    });
    return candidates;
  } catch (error) {
    console.warn(
      "Unable to detect an index?(.windows).{ts,tsx,js,jsx} file in the root of the project, so will fall back to a <BundleEntryFile> value to 'index.ts'.",
      error,
    );
    return ["index.ts"];
  }
}

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
    expoConfigModule = require("@expo/config");
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
    expoConfigPluginsModule = require("@expo/config-plugins");
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

function logProjectReady({
  cdPath,
  packageManager,
}: {
  cdPath: string;
  packageManager: "npm" | "bun" | "pnpm" | "yarn";
}) {
  const lines = [
    "✅ Your project is ready!",
    "",
    "To run your project, first navigate to the directory and start up the packager:",
    "",
    `- cd ${cdPath}`,
    `- ${formatRunCommand(packageManager, "start")}`,
    "",
    "… and then run the target platform of your choice:",
    "",
    `- ${formatRunCommand(packageManager, "android")}`,
    `- ${formatRunCommand(packageManager, "ios")}`,
    `- ${formatRunCommand(packageManager, "web")}`,
    `- ${formatRunCommand(packageManager, "macos")}`,
    `- ${formatRunCommand(packageManager, "windows")}`,
    "",
  ];

  log.success(lines.join("\n"), { withGuide: false });
}

export function formatRunCommand(packageManager: "npm" | "bun" | "pnpm" | "yarn", cmd: string) {
  switch (packageManager) {
    case "pnpm":
      return `pnpm run ${cmd}`;
    case "yarn":
      return `yarn ${cmd}`;
    case "bun":
      return `bun run ${cmd}`;
    case "npm":
    default:
      return `npm run ${cmd}`;
  }
}
