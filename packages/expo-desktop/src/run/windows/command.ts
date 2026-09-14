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
  scheme: string | undefined;
  binary: string | undefined;
  configuration: string | undefined;
  port?: string | undefined;
}) {
  const options: Options = {
    ...(args.port !== undefined ? { port: args.port } : {}),
    install: !args["no-install"],
    buildCache: !args["no-build-cache"],
    bundler: !args["no-bundler"],
    ...(args.scheme !== undefined ? { scheme: args.scheme } : {}),
    ...(args.binary !== undefined ? { binary: args.binary } : {}),
    ...(args.configuration !== undefined ? { configuration: args.configuration } : {}),
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop run windows")}.`, { withGuide: false });

  await (
    await import("./runWindowsAsync.ts")
  ).runWindowsAsync(
    args["project-root"] ? path.resolve(args["project-root"]) : process.cwd(),
    options,
  );
}
