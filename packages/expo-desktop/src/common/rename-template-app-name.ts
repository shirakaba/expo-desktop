import { IOSConfig } from "@expo/config-plugins";
import { glob } from "glob";
import fs from "node:fs";
import path from "node:path";

/**
 * Returns a list of files within a template matched by the resolved rename
 * config.
 *
 * The rename config is resolved in the order of preference:
 * Config provided as function param > defaultRenameConfig
 */
export async function getTemplateFilesToRenameAsync(
  cwd: string,
  {
    renameConfig: userConfig,
  }: {
    renameConfig?: Array<string> | undefined;
  } = {},
) {
  let config = userConfig ?? [...defaultRenameConfig];

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

/**
 * # Background
 *
 * `@expo/cli` and `create-expo` extract a template from a tarball (whether from
 * a local npm project or a GitHub repository), but these templates have a
 * static name that needs to be updated to match whatever app name the user
 * specified.
 *
 * By convention, the app name of all templates is "HelloWorld". During
 * extraction, filepaths are transformed via `createEntryResolver()` in
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
 *
 * @see https://github.com/expo/expo/pull/27212
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/prebuild/renameTemplateAppName.ts
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

export async function renameTemplateAppNameAsync(
  cwd: string,
  {
    filesafeName,
    files,
  }: {
    filesafeName: string;
    files: Array<string>;
  },
) {
  if (!files.length) {
    return;
  }

  await Promise.all(
    files.map(async (file) => {
      const absoluteFilePath = path.resolve(cwd, file);

      let contents: string;
      try {
        contents = await fs.promises.readFile(absoluteFilePath, { encoding: "utf-8" });
      } catch (cause) {
        throw new Error(
          `Failed to read template file: "${absoluteFilePath}". Was it removed mid-operation?`,
          { cause },
        );
      }

      const safeName = [".xml", ".plist", ".xaml", ".appxmanifest"].includes(path.extname(file))
        ? escapeXMLCharacters(filesafeName)
        : filesafeName;

      try {
        const replacement = contents
          .replace(/Hello App Display Name/g, safeName)
          .replace(/HelloWorld/g, IOSConfig.XcodeUtils.sanitizedName(safeName))
          .replace(/helloworld/g, IOSConfig.XcodeUtils.sanitizedName(safeName.toLowerCase()));

        if (replacement === contents) {
          return;
        }

        await fs.promises.writeFile(absoluteFilePath, replacement);
      } catch (cause) {
        throw new Error(
          `Failed to overwrite template file: "${absoluteFilePath}". Was it removed mid-operation?`,
          { cause },
        );
      }
    }),
  );
}

function escapeXMLCharacters(original: string) {
  const noAmps = original.replace("&", "&amp;");
  const noLt = noAmps.replace("<", "<");
  const noGt = noLt.replace(">", ">");
  const noApos = noGt.replace('"', '\\"');
  return noApos.replace("'", "\\'");
}
