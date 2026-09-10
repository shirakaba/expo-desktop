import { getConfig } from "@expo/config";

import type { Options, BuildProps } from "../XcodeBuild.types.ts";

import { resolveBundlerPropsAsync } from "../../../common/expo/resolve-bundler-props.ts";
import { resolveBuildCacheProvider } from "../expo/build-cache-providers/build-cache-providers.ts";
import { resolveNativeSchemePropsAsync } from "./resolveNativeScheme.ts";
import { resolveXcodeProject } from "./resolveXcodeProject.ts";

/** Resolve arguments for the `run macos` command. */
export async function resolveOptionsAsync(
  projectRoot: string,
  options: Options,
): Promise<BuildProps> {
  const xcodeProject = resolveXcodeProject(projectRoot);

  const bundlerProps = await resolveBundlerPropsAsync(projectRoot, options);

  // Resolve the scheme before the device. macOS has one device—the host—but the
  // scheme still determines which native application target Xcode builds.
  const { name: scheme } = await resolveNativeSchemePropsAsync(projectRoot, options, xcodeProject);

  // Use the configuration or `Debug` if none is provided.
  const configuration = options.configuration || "Debug";

  // macOS has no simulator or device picker. The host is the only possible target.
  const device = {
    name: "macOS host",
    udid: "host",
    osType: "macOS" as const,
  };

  const projectConfig = getConfig(projectRoot);
  const buildCacheProvider = await resolveBuildCacheProvider(
    projectConfig.exp?.buildCacheProvider ?? projectConfig.exp.experiments?.buildCacheProvider,
    projectRoot,
  );

  // This optimization skips resetting the Metro cache needlessly.
  // The cache is reset in `../node_modules/react-native/scripts/react-native-xcode.sh` when the
  // project is running in Debug and built onto a physical device. It seems that this is done because
  // the script is run from Xcode and unaware of the CLI instance.
  const shouldSkipInitialBundling = configuration === "Debug";

  return {
    ...bundlerProps,
    projectRoot,
    isSimulator: false,
    xcodeProject,
    device,
    osType: "macOS",
    configuration,
    shouldSkipInitialBundling,
    buildCache: options.buildCache !== false,
    scheme,
    buildCacheProvider,
  };
}
