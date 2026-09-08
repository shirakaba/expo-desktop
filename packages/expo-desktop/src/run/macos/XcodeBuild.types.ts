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
  /** Port to use for Metro. */
  port: number;
  /** Start Metro after the native build. */
  shouldStartBundler: boolean;
};
