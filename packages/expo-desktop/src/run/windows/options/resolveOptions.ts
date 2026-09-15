import type { Options, BuildProps } from "../WindowsBuild.types.ts";

import { CommandError } from "../../../common/expo/error.ts";
import { resolveBundlerPropsAsync } from "../../../common/expo/resolve-bundler-props.ts";
import { parseArch, parseDirectDebuggingPort } from "../RNWCLI.ts";
import { resolveWindowsProject } from "./resolveWindowsProject.ts";

/** Resolve arguments for the `run windows` command. */
export async function resolveOptionsAsync(
  projectRoot: string,
  options: Options,
): Promise<BuildProps> {
  // FIXME: broken slop
  const windowsProject = await resolveWindowsProject(projectRoot, "MyApp");

  const bundlerProps = await resolveBundlerPropsAsync(projectRoot, options);

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
    shouldSkipInitialBundling,
    buildCache: options.buildCache !== false,

    runWindowsOptions: {
      release: options.configuration === "Release",
      root: projectRoot,
      arch: parseArch(options.arch),
      singleproc: !!options.singleproc,
      emulator: false,
      device: false,
      // target: undefined,
      // remoteDebugging: undefined,
      ...(options.logging ? { logging: options.logging } : {}),
      packager: !!options.bundler,
      bundle: options.configuration === "Release",
      launch: options.launch,
      ...(options.autolink ? { autolink: options.autolink } : {}),
      build: !options.binary,
      // You can't launch unless you deploy.
      deploy: options.launch,
      deployFromLayout: false,
      ...(options.sln ? { sln: options.sln } : {}),
      ...(options.proj ? { proj: options.proj } : {}),
      ...(options.msbuildprops ? { msbuildprops: options.msbuildprops } : {}),
      ...(options.buildLogDirectory ? { buildLogDirectory: options.buildLogDirectory } : {}),
      ...(options.info ? { info: options.info } : {}),
      // TODO: check if we ought to validate this port in advance
      ...(options.directDebugging
        ? { directDebugging: parseDirectDebuggingPort(options.directDebugging) }
        : {}),
      ...(options.telemetry ? { telemetry: options.telemetry } : {}),
    },
  };
}
