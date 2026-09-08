export type WindowsConfiguration = "Debug" | "Release" | string;

export type Options = {
  /** Dev server port to use, ignored if `bundler` is `false`. */
  port?: number;
  /** Windows project to build, corresponding to RNW's `--proj` option. */
  scheme?: string;
  /** MSBuild configuration to build. Default `Debug`. */
  configuration?: WindowsConfiguration;
  /** Should start the bundler dev server. */
  bundler?: boolean;
  /** Should install missing dependencies before building. */
  install?: boolean;
  /** Should clean the native build output before building. */
  buildCache?: boolean;
  /** Path to an existing Windows `.exe` to launch. */
  binary?: string;
};

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
  /** Root to the Windows native project. */
  projectRoot: string;
  /** The target is always the host Windows device. */
  isSimulator: false;
  windowsProject: ProjectInfo;
  /** Windows has exactly one target device: the host. */
  device: WindowsDevice;
  osType: "Windows";
  configuration: WindowsConfiguration;
  /** Disable the initial bundling from the native script. */
  shouldSkipInitialBundling: boolean;
  /** Should use the native build cache. */
  buildCache: boolean;
  /** Windows project target, the closest equivalent to an Xcode scheme. */
  scheme: string;
  /** Port to use for Metro. */
  port: number;
  /** Start Metro after the native build. */
  shouldStartBundler: boolean;
};
