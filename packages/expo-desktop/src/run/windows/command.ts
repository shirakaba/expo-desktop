import { log } from "@clack/prompts";
import Debug from "debug";
import { default as kleur } from "kleur";
import path from "node:path";

import type { Options } from "./WindowsBuild.types.ts";

const debug = Debug("expo-desktop:run:windows") as typeof console.log;

/**
 * The entrypoint for `npx expo run ios` is here:
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/index.ts
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/ios/runIosAsync.ts
 */
export async function run(args: {
  "project-root": string | undefined;
  "no-build-cache": boolean | undefined;
  "no-install": boolean | undefined;
  "no-bundler": boolean | undefined;
  binary: string | undefined;
  configuration: string | undefined;
  port?: string | undefined;
  arch?: string | undefined;
  singleproc: boolean | undefined;
  logging: boolean | undefined;
  "no-launch": boolean | undefined;
  "no-autolink": boolean | undefined;
  sln?: string | undefined;
  proj?: string | undefined;
  msbuildprops?: string | undefined;
  "direct-debugging"?: string | undefined;
  "no-telemetry": boolean | undefined;
}) {
  const options: Options = {
    ...(args.port !== undefined ? { port: args.port } : {}),
    install: !args["no-install"],
    buildCache: !args["no-build-cache"],
    bundler: !args["no-bundler"],
    ...(args.binary !== undefined ? { binary: args.binary } : {}),
    ...(args.configuration !== undefined ? { configuration: args.configuration } : {}),
    ...(args.arch !== undefined ? { arch: args.arch } : {}),
    ...(args.singleproc !== undefined ? { singleproc: args.singleproc } : {}),
    ...(args.logging ? { logging: args.logging } : {}),
    launch: !args["no-launch"],
    autolink: !args["no-autolink"],
    ...(args.sln ? { sln: args.sln } : {}),
    ...(args.proj ? { proj: args.proj } : {}),
    ...(args.msbuildprops ? { msbuildprops: args.msbuildprops } : {}),
    ...(args["direct-debugging"] !== undefined
      ? { directDebugging: args["direct-debugging"] }
      : {}),
    telemetry: !args["no-telemetry"],
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop run windows")}.`, { withGuide: false });

  await (
    await import("./runWindowsAsync.ts")
  ).runWindowsAsync(
    args["project-root"] ? path.resolve(args["project-root"]) : process.cwd(),
    options,
  );
}
