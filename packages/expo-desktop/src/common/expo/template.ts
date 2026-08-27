// https://github.com/expo/expo/blob/main/packages/create-expo/src/Template.ts

import type { ExpoConfig } from "@expo/config";
import type { JSONObject } from "@expo/json-file";
import type { default as JsonFileType } from "@expo/json-file";

import * as PackageManager from "@expo/package-manager";
import chalk from "chalk";
import Debug from "debug";
import { glob } from "glob";
import { default as kleur } from "kleur";
import { grey } from "kleur/colors";
import mustache from "mustache";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import ora from "ora";
import prompts from "prompts";

import type { PackageManagerName } from "./resolve-package-manager.ts";

import packageJson from "../../../package.json" with { type: "json" };
import { validateBundleId } from "../../prebuild/validate-application-id.ts";
import { sanitizedName } from "./create-file-transform.ts";
import { env } from "./env.ts";
import { downloadAndExtractGitHubRepositoryAsync } from "./github.ts";
import { Log } from "./log.ts";
import {
  applyBetaTag,
  applyKnownNpmPackageNameRules,
  downloadAndExtractNpmModuleAsync,
  getResolvedTemplateName,
} from "./npm.ts";
import { formatRunCommand } from "./resolve-package-manager.ts";
import * as Template from "./template.ts";

const require = createRequire(import.meta.url);

const JsonFile = (require("@expo/json-file") as typeof JsonFileType).default;

const debug = Debug("expo-desktop:create-app:template") as typeof console.log;

const isMacOS = process.platform === "darwin";
const isWindows = process.platform === "win32";

// keep this list in sync with the validation helper in WWW: src/utils/experienceParser.ts
const FORBIDDEN_NAMES = [
  "react-native",
  "react",
  "react-dom",
  "react-native-web",
  "expo",
  "expo-router",
];

export function isFolderNameForbidden(folderName: string): boolean {
  return FORBIDDEN_NAMES.includes(folderName);
}

function deepMerge(target: any, source: any) {
  if (typeof target !== "object") {
    return source;
  }
  if (Array.isArray(target) && Array.isArray(source)) {
    return target.concat(source);
  }
  Object.keys(source).forEach((key) => {
    if (typeof source[key] === "object" && source[key] !== null) {
      target[key] = deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  });
  return target;
}

function coerceUrl(urlString: string) {
  try {
    return new URL(urlString);
  } catch (e) {
    if (!/^(https?:\/\/)/.test(urlString)) {
      return new URL(`https://${urlString}`);
    }
    throw e;
  }
}

export function resolvePackageModuleId(moduleId: string) {
  if (
    // Expands github shorthand (owner/repo) to full URLs
    moduleId.includes("/") &&
    !(
      moduleId.startsWith("@") || // Scoped package
      moduleId.startsWith(".") || // Relative path
      moduleId.startsWith(path.sep) || // Absolute path
      // Contains a protocol
      /^[a-z][-a-z0-9\\.\\+]*:/.test(moduleId)
    )
  ) {
    moduleId = `https://github.com/${moduleId}`;
  }

  if (
    // Supports github repository URLs
    /^(https?:\/\/)?github\.com\//.test(moduleId)
  ) {
    try {
      const uri = coerceUrl(moduleId);
      debug("Resolved moduleId to repository path:", moduleId);
      return { type: "repository", uri } as const;
    } catch {
      throw new Error(`Invalid URL: "${moduleId}" provided`);
    }
  }

  if (
    // Supports `file:./path/to/template.tgz`
    moduleId?.startsWith("file:") ||
    // Supports `../path/to/template.tgz`
    moduleId?.startsWith(".") ||
    // Supports `\\path\\to\\template.tgz`
    moduleId?.startsWith(path.sep)
  ) {
    if (moduleId?.startsWith("file:")) {
      moduleId = moduleId.substring(5);
    }
    debug(`Resolved moduleId to file path:`, moduleId);
    return { type: "file", uri: path.resolve(moduleId) } as const;
  }

  debug(`Resolved moduleId to NPM package:`, moduleId);
  return { type: "npm", uri: moduleId } as const;
}

/**
 * Extract a template app to a given file path and clean up any properties left over from npm to
 * prepare it for usage.
 */
export async function extractAndPrepareTemplateAppAsync({
  projectRoot,
  displayName,
  rdns,
  npmPackage,
}: {
  projectRoot: string;
  displayName: string | undefined;
  rdns: string | undefined;
  npmPackage?: string | null;
}) {
  /**
   * create-expo-app takes the basename of the projectRoot here.
   * @see https://github.com/expo/expo/blob/037d1aa47f15e062cc2185393f08b3c08870ed65/packages/create-expo/src/Template.ts#L131
   *
   * We
   */
  const projectName = path.basename(projectRoot);

  debug(`Extracting template app (pkg: ${npmPackage}; projectName: ${projectName})`);

  const { type, uri } = resolvePackageModuleId(
    npmPackage || "expo-desktop-template-blank-typescript",
  );

  if (type === "repository") {
    await downloadAndExtractGitHubRepositoryAsync(uri, projectRoot, { expName: projectName });
  } else {
    const resolvedUri = type === "file" ? uri : getResolvedTemplateName(applyBetaTag(uri));
    await downloadAndExtractNpmModuleAsync(resolvedUri, projectRoot, {
      expName: projectName,
      disableCache: type === "file",
    });
  }

  // Unlike create-expo-app, we run this step *before*
  // renameTemplateAppNameAsync(), because we need to establish the name and
  // windowsTemplateStrings in order to rename the Windows template properly.
  const { name, windowsTemplateStrings } = await sanitizeTemplateAsync({
    displayName,
    projectRoot,
    rdns,
  });

  try {
    const files = await getTemplateFilesToRenameAsync({ cwd: projectRoot });
    await renameTemplateAppNameAsync({
      cwd: projectRoot,
      files,
      name,
      windowsTemplateStrings,
    });
  } catch (error: any) {
    Log.error("Error renaming app name in template");
    throw error;
  }

  return projectRoot;
}

export function getWindowsTemplateStrings({
  packageGuid,
  projectGuid,
  name,
}: {
  packageGuid: string;
  projectGuid: string;
  name: { displayName: string; rdns: string };
}) {
  const namespace = name.rdns.replaceAll(/[-_]/g, "");
  const namespaceCpp = namespace.replaceAll(".", "::");
  const mainComponentName = name.displayName;

  // We make a couple of hard assumptions here, based on the fact that we don't
  // support specifying canary/dev versions, mainly to avoid the chicken-and-egg
  // of having to run an `npm install` up-front to confirm for real.

  // It's a canary if the version is e.g. `0.0.0-canary.1056`.
  const isCanary = false;

  // `devMode` is `true` if there is a "src-win" at the base of the
  // react-native-windows folder.
  const devMode = false;

  return {
    /*
     * We pass "MyApp" as the filesafe name because the template overuses it,
     * renaming files like MyApp.cpp to `${filesafeName}.cpp` for no real
     * benefit.
     *
     * By keeping the names stable as MyApp, we can avoid desyncs between dirty
     * prebuilds (which don't rename files) and clean prebuilds (which do).
     */
    // name: name.filesafeName,
    name: "MyApp",
    namespace,
    namespaceCpp,
    // We can't reliably fill in the path to react-native-windows without first
    // installing node modules. However, in create-app, we unpack the template
    // before that, so we have a chicken-and-egg problem.
    //
    // Fortunately, it's a non-issue, as this template variable is only used in
    // the solution file, specifically when `useNugets: false`, which is never
    // the case, as you can see below.
    rnwPathFromProjectRoot: "node_modules\\react-native-windows",
    mainComponentName,
    projectGuidLower: `{${projectGuid.toLowerCase()}}`,
    projectGuidUpper: `{${projectGuid.toUpperCase()}}`,
    packageGuidLower: `{${packageGuid.toLowerCase()}}`,
    packageGuidUpper: `{${packageGuid.toUpperCase()}}`,
    currentUser: os.userInfo().username,
    devMode,
    useNuGets: !devMode,
    addReactNativePublicAdoFeed: true || isCanary,
    cppNugetPackages: new Array<unknown>(),
    autolinkPropertiesForProps: "",
    autolinkProjectReferencesForTargets: "",
    autolinkCppIncludes: "",
    autolinkCppPackageProviders: "\n UNREFERENCED_PARAMETER(packageProviders);",
  };
}

export type WindowsTemplateStrings = ReturnType<typeof getWindowsTemplateStrings>;

function escapeXMLCharacters(original: string): string {
  const noAmps = original.replace("&", "&amp;");
  const noLt = noAmps.replace("<", "&lt;");
  const noGt = noLt.replace(">", "&gt;");
  const noApos = noGt.replace('"', '\\"');
  return noApos.replace("'", "\\'");
}

/**
 * # Background
 *
 * `@expo/cli` and `create-expo` extract a template from a tarball (whether from
 * a local npm project or a GitHub repository), but these templates have a
 * static name that needs to be updated to match whatever app name the user
 * specified.
 *
 * By convention, the app name of all templates is "HelloWorld". During
 * extraction, filepaths are transformed via `createEntryRenamer()` in
 * `createFileTransform.ts`, but the contents of files are left untouched.
 * Technically, the contents used to be transformed during extraction as well,
 * but due to poor configurability, we've moved to a post-extraction approach.
 *
 * # The new approach: Renaming the app post-extraction
 *
 * In this new approach, we take a list of file patterns, otherwise known as the
 * "rename config" to determine explicitly which files – relative to the root of
 * the template – to perform find-and-replace on, to update the app name.
 *
 * ## The rename config
 *
 * The rename config can be passed directly as a string array to
 * `getTemplateFilesToRenameAsync()`.
 *
 * The file patterns are formatted as glob expressions to be interpreted by
 * [glob](https://github.com/isaacs/node-glob). Comments are supported with
 * the `#` symbol, both in the plain-text file and string array formats.
 * Whitespace is trimmed and whitespace-only lines are ignored.
 *
 * If no rename config has been passed directly to
 * `getTemplateFilesToRenameAsync()` then this default rename config will be
 * used instead.
 */
export const defaultRenameConfig = [
  // Common
  "!**/node_modules",
  "app.json",

  // Android
  "android/**/*.gradle",
  "android/app/BUCK",
  "android/app/src/**/*.java",
  "android/app/src/**/*.kt",
  "android/app/src/**/*.xml",

  // iOS
  "ios/Podfile",
  "ios/**/*.xcodeproj/project.pbxproj",
  "ios/**/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme",
  "ios/**/*.xcworkspace/contents.xcworkspacedata",

  // macOS
  "macos/Podfile",
  "macos/**/*.xcodeproj/project.pbxproj",
  "macos/**/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme",
  "macos/**/*.xcworkspace/contents.xcworkspacedata",

  // Windows
  "NuGet.config",
  "windows/**/*.sln",
  "windows/**/*.vcxproj",
  "windows/**/*.vcxproj.filters",
  "windows/**/*.vcxitems",
  "windows/**/*.vcxitems.filters",
  "windows/**/*.props",
  "windows/**/*.targets",
  "windows/**/*.h",
  "windows/**/*.hpp",
  "windows/**/*.c",
  "windows/**/*.cpp",
  "windows/**/*.idl",
  "windows/**/*.rc",
  "windows/**/*.xml",
  "windows/**/*.xaml",
  "windows/**/*.appxmanifest",
] as const;

/**
 * Returns a list of files within a template matched by the resolved rename
 * config.
 *
 * The rename config is resolved in the order of preference:
 * Config provided as function param > defaultRenameConfig
 */
export async function getTemplateFilesToRenameAsync({
  cwd,
  /**
   * An array of patterns following the rename config format. If omitted, then
   * we fall back to defaultRenameConfig.
   * @see defaultRenameConfig
   */
  renameConfig: userConfig,
}: {
  cwd: string;
  renameConfig?: string[];
}) {
  let config = userConfig ?? defaultRenameConfig;

  // Strip comments, trim whitespace, and remove empty lines.
  config = config
    .map((line) => line.split(/(?<!\\)#/, 2)[0]?.trim() ?? "")
    .filter((line) => line !== "");

  return await glob(config, {
    cwd,
    // `true` is consistent with .gitignore. Allows `*.xml` to match .xml files
    // in all subdirs.
    matchBase: true,
    dot: true,
    // Prevent climbing out of the template directory in case a template
    // includes a symlink to an external directory.
    follow: false,
  });
}

export async function renameTemplateAppNameAsync({
  cwd,
  name,
  files,
  windowsTemplateStrings,
}: {
  cwd: string;
  name: { displayName: string; filesafeName: string; rdns: string };
  /**
   * An array of files to transform. Usually provided by calling
   * getTemplateFilesToRenameAsync().
   * @see getTemplateFilesToRenameAsync
   */
  files: string[];
  windowsTemplateStrings: WindowsTemplateStrings;
}) {
  debug(`Got files to transform: ${JSON.stringify(files)}`);

  await Promise.all(
    files.map(async (file) => {
      const absoluteFilePath = path.resolve(cwd, file);

      let contents: string;
      try {
        contents = await fs.promises.readFile(absoluteFilePath, { encoding: "utf-8" });
      } catch (error) {
        throw new Error(
          `Failed to read template file: "${absoluteFilePath}". Was it removed mid-operation?`,
          { cause: error },
        );
      }

      debug(`Renaming app name in file: ${absoluteFilePath}`);

      const { base, ext } = path.parse(file);

      const xmlSafeName = [".xml", ".plist"].includes(ext)
        ? escapeXMLCharacters(name.filesafeName)
        : name.filesafeName;

      let replacement = contents;

      try {
        // The Windows files are unique in that they use Mustache syntax and
        // use "MyApp" as their placeholder, rather than "HelloWorld".
        if (/^windows[\/\\]/.test(file) || base === "NuGet.config") {
          replacement = renderMustache(replacement, windowsTemplateStrings);

          if (ext === ".vcxproj") {
            replacement = replacement.replace(
              /<!--\s*This project was created with react-native-windows[^\n\r]*-->/g,
              `<!-- This project was created with expo-desktop ${packageJson.version} -->`,
            );
          }
        } else {
          replacement = replacement
            .replace(/Hello App Display Name/g, name.displayName)
            .replace(/HelloWorld/g, sanitizedName(xmlSafeName))
            .replace(/helloworld/g, sanitizedName(xmlSafeName.toLowerCase()));
        }

        if (replacement === contents) {
          return;
        }

        await fs.promises.writeFile(absoluteFilePath, replacement);
      } catch (error) {
        throw new Error(
          `Failed to overwrite template file: "${absoluteFilePath}". Was it removed mid-operation?`,
          { cause: error },
        );
      }
    }),
  );
}

/**
 * Render mustache tags inside `filePath` in place, mirroring the behaviour of
 * react-native-windows' generator-common `resolveContents()`. Skips files that
 * don't exist, files that don't contain any `{{` (no-op fast path), and
 * preserves the file's existing line endings (LF vs CRLF).
 *
 * @see https://github.com/microsoft/react-native-windows/blob/main/packages/%40react-native-windows/cli/src/generator-common/index.ts
 */
function renderMustache(contents: string, view: Record<string, unknown>) {
  if (!contents.includes("{{")) {
    return contents;
  }

  const useCRLF = contents.includes("\r\n");
  const adjustedView = adjustReplacementStringsForLineEndings(view, useCRLF);
  return mustache.render(contents, adjustedView);
}

function adjustReplacementStringsForLineEndings(
  view: Record<string, unknown>,
  useCRLF: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...view };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string") {
      out[key] = useCRLF ? value.replaceAll(/(?<!\r)\n/g, "\r\n") : value.replaceAll(/\r\n/g, "\n");
    }
  }
  return out;
}

function templateHasNativeCode(root: string): boolean {
  return [path.join(root, "android"), path.join(root, "ios")].some((folder) =>
    fs.existsSync(folder),
  );
}

/**
 * Sanitize a template (or example) with expected `package.json` properties and files.
 */
export async function sanitizeTemplateAsync({
  displayName: displayNameArg,
  rdns: rdnsArg,
  projectRoot,
}: {
  displayName: string | undefined;
  rdns: string | undefined;
  projectRoot: string;
}) {
  const projectName = path.basename(projectRoot);

  debug(`Sanitizing template or example app (projectName: ${projectName})`);

  const templatePath = path.join(import.meta.dirname, "../template/gitignore");
  const ignorePath = path.join(projectRoot, ".gitignore");

  let nativeFoldersIgnored = false;
  if (!fs.existsSync(ignorePath)) {
    if (process.env.NODE_ENV !== "test") {
      await fs.promises.copyFile(templatePath, ignorePath);
    }
  } else {
    // If the template has a gitignore file already, we apply a heuristic to check if it ignores
    // native folders. We're not strictly checking both ios|android but either loosely
    try {
      const ignoreContents = fs.readFileSync(ignorePath, "utf-8");
      nativeFoldersIgnored = /^\/?(?:ios|android)\/?/gm.test(ignoreContents);
    } catch {
      nativeFoldersIgnored = false;
    }
  }

  const name = await configureAppName({
    "display-name": displayNameArg,
    "filesafe-name": projectName,
    rdns: rdnsArg,
  });
  const { displayName, filesafeName, rdns } = name;
  const androidPackage = rdns.replaceAll(/[_-]/g, "_");
  const bundleIdentifier = rdns.replaceAll("_", "-");
  const windowsNamespace = rdns.replaceAll(/[_-]/g, "");

  const packageGuid = crypto.randomUUID();
  const projectGuid = crypto.randomUUID();

  const windowsTemplateStrings = getWindowsTemplateStrings({
    name: { displayName, rdns },
    packageGuid,
    projectGuid,
  });

  const defaultConfig: ExpoConfig = {
    name: filesafeName,
    slug: filesafeName,
    ios: {
      bundleIdentifier,
      infoPlist: {
        CFBundleName: displayName,
      },
    },
    android: {
      package: androidPackage,
    },
    // @ts-expect-error macos and windows missing from types
    windows: {
      displayName,
      namespace: windowsNamespace,
      packageGuid: crypto.randomUUID(),
      projectGuid: crypto.randomUUID(),
    },
    macos: {
      bundleIdentifier,
      infoPlist: {
        CFBundleName: displayName,
      },
    },
  };

  const appFile = new JsonFile(path.join(projectRoot, "app.json"), { default: {} });
  const appContent = (await appFile.readAsync()) as ExpoConfig | Record<"expo", ExpoConfig>;

  // deepMerge() is a little inconvenient for arrays. Here, we merge in
  // whichever platforms, out of "ios", "android", "macos", and "windows", that
  // the app.json doesn't have already.
  const platforms = new Set<string>(
    "expo" in appContent ? appContent.expo.platforms : appContent.platforms,
  );
  defaultConfig.platforms = ["ios", "android", "macos", "windows"].filter(
    (platform) => !platforms.has(platform),
  ) as NonNullable<ExpoConfig["platforms"]>;

  const appJson = deepMerge(
    appContent,
    "expo" in appContent ? { expo: defaultConfig } : defaultConfig,
  );

  await appFile.writeAsync(appJson);
  debug(`Created app.json:\n%O`, appJson);

  const packageFile = new JsonFile(path.join(projectRoot, "package.json"));
  const packageJson = await packageFile.readAsync();
  // name and version are required for yarn workspaces (monorepos)
  const inputName = "name" in appJson ? appJson.name : appJson.expo.name;
  packageJson.name = applyKnownNpmPackageNameRules(inputName) || "app";
  // These are metadata fields related to the template package, let's remove them from the package.json.
  // A good place to start
  packageJson.version = "1.0.0";
  packageJson.private = true;
  delete packageJson.description;
  delete packageJson.tags;
  delete packageJson.repository;

  if (
    (typeof packageJson.scripts === "object" || packageJson.scripts == null) &&
    !(packageJson.scripts as JSONObject)?.android &&
    !(packageJson.scripts as JSONObject)?.ios &&
    !(packageJson.scripts as JSONObject)?.macos &&
    !(packageJson.scripts as JSONObject)?.windows
  ) {
    // When we're creating a template that:
    // - does not have ios/android/macos/windows scripts
    // - doesn't have native codes
    // - has native folders ignored
    // we automatically add ios/android/macos/windows scripts since prebuild
    // will likely trigger, and used to add these scripts automatically but
    // doesn't anymore
    if (templateHasNativeCode(projectRoot)) {
      packageJson.scripts = {
        ...packageJson.scripts,
        android: "expo run:android",
        ios: "expo run:ios",
        macos: "rnc-cli run-macos",
        windows: "rnc-cli run-windows",
      };
    } else if (nativeFoldersIgnored) {
      // TODO: Figure out why this didn't run
      packageJson.scripts = {
        ...packageJson.scripts,
        android: "expo start --android",
        ios: "expo start --ios",
        macos:
          "node -e \"console.log('Please run \\`npx expo-desktop prebuild\\` to set up the React Native macOS project.'); process.exit(1);\"",
        windows:
          "node -e \"console.log('Please run \\`npx expo-desktop prebuild\\` to set up the React Native Windows project.'); process.exit(1);\"",
      };
    } else {
      // By default we don't do anything since we don't know if `start` or `run:*` are good defaults
      // We assume that most templates have scripts in this case (e.g. the default template has its own already)
    }
  }

  // Only strip the license if it's 0BSD, used by our templates. Leave other licenses alone.
  if (packageJson.license === "0BSD") {
    delete packageJson.license;
  }

  await packageFile.writeAsync(packageJson);

  return { name, windowsTemplateStrings };
}

async function configureAppName(args: {
  "filesafe-name": string | undefined;
  initialFilesafeName?: string;
  "display-name": string | undefined;
  initialDisplayName?: string;
  rdns: string | undefined;
  initialRdns?: string;
}) {
  const { initialFilesafeName, initialDisplayName, initialRdns } = args;

  // TODO: Upon any cancel, provide the CLI command to get back to the cancelled
  //       step.

  let filesafeName = args["filesafe-name"];
  if (!filesafeName) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `Please provide the ${kleur.bold("filesafe name")} for the app in ${kleur.bold("alphanumeric")} format. ${grey("(Example: 'MyApp123')")}`,
      initial: initialFilesafeName ?? "MyApp",
      validate: (name) => {
        const validation = Template.validateName(path.basename(path.resolve(name)));
        if (typeof validation === "string") {
          return "Invalid filesafe name: " + validation;
        }
        return true;
      },
    });

    filesafeName = answer;
    assert.ok(filesafeName, "Expected prompt to provide truthy string.");
  }

  let displayName = args["display-name"];
  if (!displayName) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `Please provide the ${kleur.bold("display name")} for the app. ${grey("(Examples: 'My App 123', '俺のアプリ')")}`,
      initial: initialDisplayName ?? "My App",
      validate: (name) => {
        if (!name) {
          return "Must be at least one character long.";
        }

        return true;
      },
    });

    displayName = answer;
    assert.ok(displayName, "Expected prompt to provide truthy string.");
  }

  let rdns = args.rdns;
  if (!rdns) {
    const { answer } = await prompts({
      type: "text",
      name: "answer",
      message: `Please provide the ${kleur.bold("reverse DNS")} for the app. ${grey("(Example: 'com.example.my-app-123')")}`,
      initial: initialRdns ?? "com.example.my-app",
      validate: (rdns) => {
        // TODO: Improve the validateBundleId() regex so that we don't have to
        //       do this initial check before handing over to it.
        if (!/^[a-zA-Z]+/.test(rdns)) {
          return "Must begin with a letter.";
        }

        if (!validateBundleId(rdns.replaceAll("_", "-"))) {
          return "Must use only alphanumerics, periods, and hyphens (or underscores)";
        }

        return true;
      },
    });

    rdns = answer;
    assert.ok(rdns, "Expected prompt to provide truthy string.");
  }

  return {
    filesafeName,
    displayName,
    rdns,
  };
}

/**
 * Validate the filesafeName for the app.
 *
 * create-expo-app normally accepts some punctuation beyond alphanumerics,
 * but we accept strictly alphanumerics so that we can use the
 * filesafeName more widely for other purposes as-is, without coercing.
 * - https://github.com/expo/expo/blob/6e418b5947dd8806ac97c19eb959ded3a1b14ea2/packages/create-expo/src/resolveProjectRoot.ts#L46-L53
 * - https://github.com/expo/expo/blob/037d1aa47f15e062cc2185393f08b3c08870ed65/packages/create-expo/src/Template.ts#L439
 */
export function validateName(name?: string): string | true {
  if (typeof name !== "string" || name === "") {
    return "The filesafe name can not be empty.";
  }
  if (!/^[a-zA-Z0-9]+$/.test(name)) {
    return "Invalid filesafe name: The filesafe name can only contain alphanumeric characters.";
  }

  return true;
}

export function logProjectReady({
  cdPath,
  packageManager,
}: {
  cdPath: string;
  packageManager: PackageManagerName;
}) {
  console.log(chalk.bold(`✅ Your project is ready!`));
  console.log();

  // empty string if project was created in current directory
  if (cdPath) {
    console.log(
      `To run your project, navigate to the directory and run one of the following ${packageManager} commands.`,
    );
    console.log();
    console.log(`- ${chalk.bold("cd " + cdPath)}`);
  } else {
    console.log(`To run your project, run one of the following ${packageManager} commands.`);
    console.log();
  }

  console.log(`- ${chalk.bold(formatRunCommand(packageManager, "android"))}`);

  const macOSComment = isMacOS
    ? ""
    : " # you need to use macOS to build the iOS or macOS projects - use the Expo app if you need to do Apple development without a Mac";
  console.log(`- ${chalk.bold(formatRunCommand(packageManager, "ios"))}${macOSComment}`);
  console.log(`- ${chalk.bold(formatRunCommand(packageManager, "macos"))}${macOSComment}`);

  const windowsComment = isWindows ? "" : " # you need to use Windows to build the Windows project";
  console.log(`- ${chalk.bold(formatRunCommand(packageManager, "windows"))}${windowsComment}`);
  console.log(`- ${chalk.bold(formatRunCommand(packageManager, "web"))}`);
}

export async function installPodsAsync(projectRoot: string, platform: "ios" | "macos") {
  let step = logNewSection("Installing CocoaPods.");
  if (process.platform !== "darwin") {
    step.succeed("Skipped installing CocoaPods because operating system is not macOS.");
    return false;
  }
  const packageManager = new PackageManager.CocoaPodsPackageManager({
    cwd: path.join(projectRoot, platform),
    silent: !env.EXPO_DEBUG,
  });

  if (!(await packageManager.isCLIInstalledAsync())) {
    try {
      step.text = "CocoaPods CLI not found in your $PATH, installing it now.";
      step.render();
      await packageManager.installCLIAsync();
      step.succeed("Installed CocoaPods CLI");
      step = logNewSection("Running `pod install` in the `ios` directory.");
    } catch (e: any) {
      step.stopAndPersist({
        symbol: "⚠️ ",
        text: chalk.red(
          "Unable to install the CocoaPods CLI. Continuing with initializing the project, you can install CocoaPods afterwards.",
        ),
      });
      if (e.message) {
        Log.error(`- ${e.message}`);
      }
      return false;
    }
  }

  try {
    await packageManager.installAsync();
    step.succeed("Installed pods and initialized Xcode workspace.");
    return true;
  } catch (e: any) {
    step.stopAndPersist({
      symbol: "⚠️ ",
      text: chalk.red(
        `Something went wrong running \`pod install\` in the \`${platform}\` directory. Continuing with initializing the project, you can debug this afterwards.`,
      ),
    });
    if (e.message) {
      Log.error(`- ${e.message}`);
    }
    return false;
  }
}

export function logNewSection(title: string) {
  const disabled = env.CI || env.EXPO_DEBUG;
  const spinner = ora({
    text: chalk.bold(title),
    // Ensure our non-interactive mode emulates CI mode.
    isEnabled: !disabled,
    // In non-interactive mode, send the stream to stdout so it prevents looking like an error.
    stream: disabled ? process.stdout : process.stderr,
  });

  spinner.start();
  return spinner;
}
