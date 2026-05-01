import { log } from "@clack/prompts";
import { type } from "arktype";
import { cyan, green, yellow } from "kleur/colors";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { makePrettySummary } from "../arktype.ts";
import { EnhancedAppJson, PackageJson } from "../common/app-json.ts";
import { promisifiedSpawn } from "../common/child-process.ts";
import { title } from "../common/clack.ts";
import { packageManagerExec } from "../common/npm.ts";

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
  await updatePackageJson({ projectPath, versions });

  title("Installing dependencies…", { spacing: 1 });
  await npmInstall({ cwd: projectPath, packageManager });

  title("Adding the Windows app…", { spacing: 1 });
  await addDesktopApp({ cwd: projectPath, name, packageManager, type: "windows", versions });

  title("Adding the macOS app…", { spacing: 1 });
  await addDesktopApp({ cwd: projectPath, name, packageManager, type: "macos", versions });

  title("Running Expo Prebuild for the mobile apps…", { spacing: 1 });
  await runPrebuildMobile({ packageManager, projectPath });

  // TODO: Config Plugin to customise macOS file name, etc. - may be able to use
  //       RNTA's, or just my own.
  // https://github.com/shirakaba/fiddle-template/tree/config-plugins/plugins/macos

  title("Installing Cocoapods for the iOS app…", { spacing: 1 });
  await podInstall({ projectPath, type: "ios" });

  title("Installing Cocoapods for the macOS app…", { spacing: 1 });
  await podInstall({ projectPath, type: "macos" });
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

  let appJson: ReturnType<typeof EnhancedAppJson>;
  try {
    const contents = await fs.readFile(appJsonPath, "utf-8");
    appJson = EnhancedAppJson(JSON.parse(contents));
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
  if (!appJson.expo.android) {
    appJson.expo.android = {};
  }
  appJson.expo.android.package = name.rdns.replaceAll("-", "_");

  if (!appJson["expo-desktop"]) {
    appJson["expo-desktop"] = {
      displayName: name.displayName,
      filesafeName: name.filesafeName,
      rdns: name.rdns,
    };
  }

  if (!appJson["expo-desktop"].macos) {
    appJson["expo-desktop"].macos = {};
  }
  appJson["expo-desktop"].macos.bundleIdentifier = name.rdns.replaceAll("_", "-");

  if (!appJson["expo-desktop"].windows) {
    appJson["expo-desktop"].windows = {};
  }
  // appJson["expo-desktop"].windows.namespace = name.rdns.replaceAll("-", "");
  appJson["expo-desktop"].windows.displayName = name.displayName;
  // appJson["expo-desktop"].windows.projectName = name.filesafeName;

  if (!appJson.expo.plugins) {
    appJson.expo.plugins = [];
  }
  appJson.expo.plugins = [
    ...appJson.expo.plugins,
    ["expo-desktop-config-plugins", { displayName: name.displayName }],
  ];

  try {
    await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2), "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("app.json")}`, { cause });
  }

  console.log(`${green("◆")}  Altered app.json.\n`);
}

async function updatePackageJson({
  projectPath,
  versions,
}: {
  projectPath: string;
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

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.macos = "rnc-cli run-macos";
  packageJson.scripts.windows = "rnc-cli run-windows";

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }
  packageJson.dependencies["expo-desktop-config-plugins"] = "^1.0.0";
  packageJson.dependencies["react-native-macos"] = versions.macos;
  packageJson.dependencies["react-native-windows"] = versions.windows;

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  packageJson.devDependencies["@react-native-community/cli"] = "latest";

  try {
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");
  } catch (cause) {
    throw new Error(`Error writing updated ${yellow("package.json")}`, { cause });
  }

  console.log(`${green("◆")}  Altered package.json.\n`);
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
