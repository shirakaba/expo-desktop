import { log } from "@clack/prompts";
import Debug from "debug";
import { default as kleur } from "kleur";

import type { Options } from "./XcodeBuild.types.ts";

const debug = Debug("expo-desktop:run:command") as typeof console.log;

/**
 * The entrypoint for `npx expo run ios` is here:
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/index.ts
 * @see https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/ios/runIosAsync.ts
 */
export async function run(args: {
  "no-build-cache": boolean | undefined;
  "no-install": boolean | undefined;
  "no-bundler": boolean | undefined;
  scheme: string | undefined;
  binary: string | undefined;
  output: string | undefined;
  configuration: string | undefined;
  port: number;
}) {
  const options: Options = {
    port: args.port,
    install: !args["no-install"],
    buildCache: !args["no-build-cache"],
    bundler: !args["no-bundler"],
    ...(args.scheme !== undefined ? { scheme: args.scheme } : {}),
    ...(args.binary !== undefined ? { binary: args.binary } : {}),
    ...(args.output !== undefined ? { output: args.output } : {}),
    ...(args.configuration !== undefined ? { configuration: args.configuration } : {}),
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop run macos")}.`, { withGuide: false });

  await (await import("./runMacosAsync.ts")).runMacosAsync(process.cwd(), options);
}
