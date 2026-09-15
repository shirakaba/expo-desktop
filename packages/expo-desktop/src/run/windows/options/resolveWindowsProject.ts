import { glob } from "node:fs/promises";
import path from "node:path";

import { CommandError } from "../../../common/expo/error.ts";

/** Resolve the Windows solution and app project used by RNW's `run-windows`. */
export async function resolveWindowsProject(projectRoot: string) {
  const platformProjectRoot = path.join(projectRoot, "windows");

  let solution: string | undefined;
  let project: string | undefined;
  for await (const { name, parentPath } of glob("*/*.{sln,vcxproj}", {
    cwd: platformProjectRoot,
    withFileTypes: true,
    exclude: ["**/node_modules/**", "**/@(Debug|Release|Generated Files)/**"],
  })) {
    if (name.endsWith(".sln")) {
      solution = path.join(parentPath, name);
      continue;
    }
    if (name.endsWith(".vcxproj")) {
      project = path.join(parentPath, name);
      continue;
    }
    if (solution && project) {
      break;
    }
  }

  if (!solution || !project) {
    throw new CommandError(
      "WINDOWS_MALFORMED",
      `Unable to find both a .sln file and a .vcxproj under "${platformProjectRoot}".`,
    );
  }

  return { solution, project };
}
