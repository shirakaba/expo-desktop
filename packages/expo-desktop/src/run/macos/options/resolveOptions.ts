import type { Options, BuildProps } from "../XcodeBuild.types.ts";

import { resolveBundlerPropsAsync } from "../../../common/expo/resolve-bundler-props.ts";
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

  // Debug macOS builds should load JavaScript from Metro when the bundler is enabled.
  const shouldSkipInitialBundling = configuration === "Debug" && bundlerProps.shouldStartBundler;

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
  };
}
