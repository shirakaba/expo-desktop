import type { BuildCacheProvider } from "@expo/config";

export type XcodeConfiguration = "Debug" | "Release" | string;

export type Options = {
  /** Dev server port to use, ignored if `bundler` is `false`. */
  port?: number;
  /** Xcode scheme to build. */
  scheme?: string;
  /** Xcode configuration to build. Default `Debug`. */
  configuration?: XcodeConfiguration;
  /** Should start the bundler dev server. */
  bundler?: boolean;
  /** Should install missing dependencies before building. */
  install?: boolean;
  /** Should use derived data for builds. */
  buildCache?: boolean;
  /** Path to an existing macOS `.app` to open. */
  binary?: string;
  /** Directory to copy the built app binary to after build completes. */
  output?: string;
  /** Whether to launch the app in the background. */
  background?: boolean;
  /** Whether to terminate existing app instances before launching. */
  singleInstance?: boolean;

  /** Re-bundle JS and assets, then embed in existing app, and install again. */
  rebundle?: boolean;
};

export type ProjectInfo = {
  isWorkspace: boolean;
  name: string;
};

export type MacosDevice = {
  name: string;
  udid: string;
  osType: "macOS";
};

export type BuildProps = {
  /** Root to the macOS native project. */
  projectRoot: string;
  /** The target is always the host macOS device. */
  isSimulator: false;
  xcodeProject: ProjectInfo;
  /** macOS has exactly one target device: the host. */
  device: MacosDevice;
  osType: "macOS";
  configuration: XcodeConfiguration;
  /** Disable the initial bundling from the native script. */
  shouldSkipInitialBundling: boolean;
  /** Should use derived data for builds. */
  buildCache: boolean;
  scheme: string;
  buildCacheProvider?: BuildCacheProvider | undefined;

  /** Options that were used to create the eager bundle in release builds. */
  eagerBundleOptions?: string;
} & BundlerProps;

export interface BundlerProps {
  /** Port to start the dev server on. */
  port: number;
  /** Skip opening the bundler from the native script. */
  shouldStartBundler: boolean;
}
