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

  // This optimization skips resetting the Metro cache needlessly.
  // The cache is reset in `../node_modules/react-native/scripts/react-native-xcode.sh` when the
  // project is running in Debug and built onto a physical device. It seems that this is done because
  // the script is run from Xcode and unaware of the CLI instance.
  const shouldSkipInitialBundling = configuration === "Debug";

  return {
    ...bundlerProps,
    shouldStartBundler: options.configuration === "Debug" || bundlerProps.shouldStartBundler,
    projectRoot,
    isSimulator: false,
    windowsProject,
    device,
    osType: "Windows",
    configuration,
    shouldSkipInitialBundling,
    buildCache: options.buildCache !== false,
    scheme,
  };
}

function getProjectName(windowsProject: BuildProps["windowsProject"]): string {
  return windowsProject.project
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.vcxproj$/, "");
}
