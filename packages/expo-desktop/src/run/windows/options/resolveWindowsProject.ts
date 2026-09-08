import { glob } from "glob";
import path from "node:path";

import type { Options, ProjectInfo } from "../WindowsBuild.types.ts";

import { CommandError } from "../../../common/expo/error.ts";

const ignoredPaths = ["**/node_modules/**", "**/@(Debug|Release|Generated Files)/**"];

/** Resolve the Windows solution and app project used by RNW's `run-windows`. */
export async function resolveWindowsProject(
  projectRoot: string,
  options: Pick<Options, "scheme">,
): Promise<ProjectInfo> {
  const windowsRoot = path.join(projectRoot, "windows");
  const [solutionPaths, projectPaths] = await Promise.all([
    glob("*.sln", {
      absolute: true,
      cwd: windowsRoot,
      ignore: ignoredPaths,
    }),
    glob("*/*.vcxproj", {
      absolute: true,
      cwd: windowsRoot,
      ignore: ignoredPaths,
    }),
  ]);

  if (solutionPaths.length === 0 || projectPaths.length === 0) {
    throw new CommandError(
      "WINDOWS_MALFORMED",
      `Windows project not found in project: ${projectRoot}. You can generate a project with \`expo-desktop prebuild --platform windows\``,
    );
  }

  const solution = resolveSelectedPath({
    projectRoot,
    input: options.scheme,
    paths: solutionPaths,
    extension: ".sln",
    fallback: solutionPaths[0]!,
  });
  const project = resolveSelectedPath({
    projectRoot,
    input: options.scheme,
    paths: projectPaths,
    extension: ".vcxproj",
    fallback: projectPaths[0]!,
  });

  return { solution, project };
}

function resolveSelectedPath({
  projectRoot,
  input,
  paths,
  extension,
  fallback,
}: {
  projectRoot: string;
  input: string | undefined;
  paths: string[];
  extension: ".sln" | ".vcxproj";
  fallback: string;
}): string {
  if (!input) {
    return fallback;
  }

  const inputPath = path.resolve(projectRoot, input);
  const inputBaseName = path.basename(input, path.extname(input));
  const appBaseName = inputBaseName.replace(/\.Package$/, "");
  const candidates = paths.filter(
    (candidate) =>
      candidate === inputPath ||
      path.basename(candidate) === path.basename(input) ||
      path.basename(candidate, extension) === inputBaseName ||
      path.basename(candidate, extension) === appBaseName,
  );

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  throw new CommandError(
    "WINDOWS_PROJECT",
    `Could not find a Windows ${extension} matching \`${input}\` in project: ${projectRoot}`,
  );
}
