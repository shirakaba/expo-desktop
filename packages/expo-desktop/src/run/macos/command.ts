import { log } from "@clack/prompts";
import Debug from "debug";
import { default as kleur } from "kleur";
import path from "node:path";

import type { Options } from "./XcodeBuild.types.ts";

const debug = Debug("expo-desktop:run:macos") as typeof console.log;

/**
 * The entrypoint for `npx expo run ios` is here:
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/index.ts
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/ios/runIosAsync.ts
 */
export async function run(args: {
  "unstable-rebundle": boolean;
  "project-root": string | undefined;
  "no-build-cache": boolean | undefined;
  "no-install": boolean | undefined;
  "no-bundler": boolean | undefined;
  "no-background": boolean | undefined;
  "no-single-instance": boolean | undefined;
  scheme: string | undefined;
  binary: string | undefined;
  output: string | undefined;
  configuration: string | undefined;
  port?: string | undefined;
}) {
  const options: Options = {
    ...(args.port !== undefined ? { port: args.port } : {}),
    install: !args["no-install"],
    buildCache: !args["no-build-cache"],
    bundler: !args["no-bundler"],
    background: !args["no-background"],
    singleInstance: !args["no-single-instance"],
    ...(args.scheme !== undefined ? { scheme: args.scheme } : {}),
    ...(args.binary !== undefined ? { binary: args.binary } : {}),
    ...(args.output !== undefined ? { output: args.output } : {}),
    ...(args.configuration !== undefined ? { configuration: args.configuration } : {}),
    rebundle: args["unstable-rebundle"],
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop run macos")}.`, { withGuide: false });

  await (
    await import("./runMacosAsync.ts")
  ).runMacosAsync(
    args["project-root"] ? path.resolve(args["project-root"]) : process.cwd(),
    options,
  );
}
