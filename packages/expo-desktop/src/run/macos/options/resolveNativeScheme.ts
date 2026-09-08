import { globSync } from "glob";
import path from "node:path";

import type { Options, ProjectInfo } from "../XcodeBuild.types.ts";

import * as Log from "../../../common/expo/log.ts";
import { getProjectName } from "./resolveXcodeProject.ts";

type NativeSchemeProps = {
  name: string;
};

/** Resolve the native macOS build `scheme` for a given `configuration`. */
export async function resolveNativeSchemePropsAsync(
  projectRoot: string,
  options: Pick<Options, "scheme" | "configuration">,
  xcodeProject: ProjectInfo,
): Promise<NativeSchemeProps> {
  const schemes = findSchemeNames(projectRoot);

  if (options.scheme) {
    return { name: options.scheme };
  }

  // React Native macOS templates use `<project>-macOS` as their application scheme.
  const inferredScheme = `${getProjectName(xcodeProject)}-macOS`;
  if (schemes.includes(inferredScheme)) {
    return { name: inferredScheme };
  }

  if (schemes.length === 1) {
    Log.log(`Auto selecting only available scheme: ${schemes[0]!}`);
    return { name: schemes[0]! };
  }

  const macosScheme = schemes.find((scheme) => /macos/i.test(scheme));
  return { name: macosScheme ?? inferredScheme };
}

function findSchemeNames(projectRoot: string): string[] {
  return globSync("macos/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme", {
    absolute: true,
    cwd: projectRoot,
    ignore: ["**/@(Carthage|Pods|vendor|node_modules)/**"],
  }).map((schemePath) => path.parse(schemePath).name);
}
