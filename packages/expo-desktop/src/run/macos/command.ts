import { log } from "@clack/prompts";
import Debug from "debug";
import { default as kleur } from "kleur";

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
  configuration: string | undefined;
  port: number | undefined;
}) {
  const options: typeof args & {
    noBuildCache: boolean | undefined;
    noInstall: boolean | undefined;
    install: boolean;
    noBundler: boolean | undefined;
  } = {
    noBuildCache: args["no-build-cache"],
    ["no-build-cache"]: args["no-build-cache"],
    noBundler: args["no-bundler"],
    ["no-bundler"]: args["no-bundler"],
    noInstall: args["no-install"],
    ["no-install"]: args["no-install"],
    scheme: args.scheme,
    binary: args.binary,
    configuration: args.configuration,
    port: args.port,
    install: !args["no-install"],
  };

  log.info(`🏎️  Running ${kleur.yellow("expo-desktop run macos")}.`, { withGuide: false });

  // TODO
}
