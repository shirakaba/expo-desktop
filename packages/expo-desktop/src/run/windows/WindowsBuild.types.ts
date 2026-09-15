import type { BuildCacheProvider } from "@expo/config";
import type {
  BuildArch,
  RunWindowsOptions,
} from "@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindowsOptions.d.ts";

export type Options = {
  /**
   * Future option to allow specifying Metro port. Not sure how to tell the RNW
   * app to connect to it upon launch, still.
   * Landed in react-native-windows@0.85.0-preview.1.
   * node_modules/@react-native-windows/cli/lib-commonjs/commands/runWindows/runWindows.js
   * deploy.startServerInNewWindow()
   * @see https://github.com/microsoft/react-native-windows/pull/16126
   */
  port?: string;
  /**
   * Configuration to build. Debug or Release.
   * Default `Debug`.
   * This maps to --release in rnc-cli.
   */
  configuration?: string;
  /**
   * Whether Expo should launch both Metro and its dev interface.
   * This maps to 'packager' in rnc-cli.
   */
  bundler?: boolean;
  /** Should install missing dependencies before building. */
  install?: boolean;
  /** Should clean the native build output before building. */
  buildCache?: boolean;
  /** Windows build-output directory to restore and launch without rebuilding. */
  binary?: string;
  /** Directory to export the Windows build artifacts to after the build completes. */
  output?: string;

  /** The build architecture (ARM64, x86, x64) */
  arch?: string;
  /** Enable direct debugging on specified port */
  directDebugging?: string;

  /** Launch the app after deployment */
  launch: boolean;
} & Omit<
  RunWindowsOptions,
  // Implicitly true when `options.configuration === "Release"`.
  | "release"
  // Not actually supported in RNC CLI yet.
  // But maybe we could defer to expo's Metro dev server anyway?
  | "port"
  // projectRoot.
  | "root"
  // Always false. Expo owns the Metro process and developer interface.
  | "packager"
  // Optional.
  | "arch"
  // Not supporting Windows phone for now.
  | "emulator"
  | "device"
  | "target"
  // Refers to the legacy DebugBundle and ReleaseBundle configurations -
  // however, our app template only declares Debug and Release.
  | "bundle"
  // Supported, but we represent it as a defined boolean at this stage
  | "launch"
  // Implicitly `false` when `options.binary` is provided. Otherwise true.
  | "build"
  // Installs the built app onto the device.
  // Implicitly matches the value of `options.launch` (you can only launch if
  // you first deploy).
  | "deploy"
  // Always false
  | "deployFromLayout"
  // Supported, but we represent it as a string at this stage
  | "directDebugging"
  // Deprecated in the first place
  | "remoteDebugging"
  // I don't want people deviating from the template, as it'd lead to problems
  // with the prebuild.
  | "sln"
  | "proj"
>;

export type ProjectInfo = {
  /** Absolute path to the Windows solution. */
  solution: string;
  /** Absolute path to the Windows app project. */
  project: string;
};

export type WindowsDevice = {
  name: string;
  udid: string;
  osType: "Windows";
};

export type BuildProps = {
  /** Root of the Windows native project. */
  projectRoot: string;
  /** The target is always the host Windows device. */
  isSimulator: false;
  windowsProject: ProjectInfo;
  /** Windows currently has exactly one target device: the host. */
  device: WindowsDevice;
  osType: "Windows";
  /** Native build configuration. */
  configuration: "Debug" | "Release";
  /** Disable the initial bundling from the native script. */
  shouldSkipInitialBundling: boolean;
  /** True: uses build cache for builds. False: clears the cache before building. */
  buildCache: boolean;
  buildCacheProvider?: BuildCacheProvider | undefined;

  /** Options that were used to create the eager bundle in release builds. */
  eagerBundleOptions?: string;

  runWindowsOptions: RunWindowsOptions;
} & BundlerProps;

export interface BundlerProps {
  /** Port to start the dev server on. */
  port: number;
  /** Skip opening the bundler from the native script. */
  shouldStartBundler: boolean;
}
