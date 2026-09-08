import { globSync } from "glob";
import path from "node:path";

import type { ProjectInfo } from "../XcodeBuild.types.ts";

import { CommandError } from "../../../common/expo/error.ts";

const ignoredPaths = ["**/@(Carthage|Pods|vendor|node_modules)/**"];

function findXcodeProjectPaths(
  projectRoot: string,
  extension: "xcworkspace" | "xcodeproj",
): string[] {
  return globSync(`macos/*.${extension}`, {
    absolute: true,
    cwd: projectRoot,
    ignore: ignoredPaths,
  });
}

/** Return the path and type of Xcode project in the given folder. */
export function resolveXcodeProject(projectRoot: string): ProjectInfo {
  let paths = findXcodeProjectPaths(projectRoot, "xcworkspace");
  if (paths.length) {
    return {
      // Use full path instead of relative project root so that warnings and errors contain full paths as well, this helps with filtering.
      // Also helps keep things consistent in monorepos.
      name: paths[0]!,
      // name: path.relative(projectRoot, paths[0]),
      isWorkspace: true,
    };
  }
  paths = findXcodeProjectPaths(projectRoot, "xcodeproj");
  if (paths.length) {
    return { name: paths[0]!, isWorkspace: false };
  }
  throw new CommandError(
    "MACOS_MALFORMED",
    `Xcode project not found in project: ${projectRoot}. You can generate a project with \`expo-desktop prebuild --platform macos\``,
  );
}

export function getProjectName(xcodeProject: ProjectInfo): string {
  return path.basename(xcodeProject.name, path.extname(xcodeProject.name));
}
