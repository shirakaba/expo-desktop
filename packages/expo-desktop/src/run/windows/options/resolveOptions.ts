import type { Options, BuildProps } from "../WindowsBuild.types.ts";

import { CommandError } from "../../../common/expo/error.ts";
import { resolveBundlerPropsAsync } from "../../../common/expo/resolve-bundler-props.ts";
import { resolveWindowsProject } from "./resolveWindowsProject.ts";

/** Resolve arguments for the `run windows` command. */
export async function resolveOptionsAsync(
  projectRoot: string,
  options: Options,
): Promise<BuildProps> {
  const windowsProject = await resolveWindowsProject(projectRoot, options);

  const bundlerProps = await resolveBundlerPropsAsync(projectRoot, options);

  // Resolve the project before the device. Windows has one device—the host—but
  // the project still determines which native application target MSBuild builds.
  const scheme = getProjectName(windowsProject);

  // Use the configuration or `Debug` if none is provided.
  const configuration = options.configuration || "Debug";
  if (configuration !== "Debug" && configuration !== "Release") {
    throw new CommandError(
      "WINDOWS_CONFIGURATION",
      `Unsupported Windows configuration \`${configuration}\`. Use \`Debug\` or \`Release\`.`,
    );
  }

  // Windows has no emulator or device picker. The host is the only possible target.
  const device = {
    name: "Windows host",
    udid: "host",
    osType: "Windows" as const,
  };

  // Debug Windows builds should load JavaScript from Metro when the bundler is enabled.
  const shouldSkipInitialBundling = configuration === "Debug" && bundlerProps.shouldStartBundler;

  return {
    ...bundlerProps,
    projectRoot,
    isSimulator: false,
    windowsProject,
    device,
    osType: "Windows",
    configuration,
    shouldSkipInitialBundling,
    buildCache: options.buildCache !== false,
    scheme,
    shouldStartBundler: bundlerProps.shouldStartBundler,
  };
}

function getProjectName(windowsProject: BuildProps["windowsProject"]): string {
  return windowsProject.project
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.vcxproj$/, "");
}
