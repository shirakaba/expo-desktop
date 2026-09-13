import { env } from "./env.ts";
import { CommandError } from "./error.ts";
import * as Log from "./log.ts";
import { isValidPort, resolvePortAsync } from "./port.ts";

export interface BundlerProps {
  /** Port to start the dev server on. */
  port: number;
  /** Skip opening the bundler from the native script. */
  shouldStartBundler: boolean;
}

export async function resolveBundlerPropsAsync(
  projectRoot: string,
  options: { port?: number; bundler?: boolean },
): Promise<BundlerProps> {
  const shouldStartBundler = options.bundler ?? true;

  if (!shouldStartBundler && options.port !== undefined) {
    throw new CommandError("BAD_ARGS", "--port and --no-bundler are mutually exclusive arguments");
  }

  const resolvedPort = shouldStartBundler
    ? await resolvePortAsync(projectRoot, {
        reuseExistingPort: true,
        ...(options.port !== undefined ? { defaultPort: options.port } : {}),
      })
    : null;
  const port =
    resolvedPort ??
    (isValidPort(options.port) && options.port > 0
      ? options.port
      : isValidPort(env.RCT_METRO_PORT) && env.RCT_METRO_PORT > 0
        ? env.RCT_METRO_PORT
        : 8081);

  // Keep native build scripts pointed at the selected/reused server. This is
  // especially important when resolvePortAsync returned null for an existing
  // Metro process.
  if (shouldStartBundler) {
    process.env.RCT_METRO_PORT = String(port);
  }

  Log.debug(`Resolved port: ${port}, start dev server: ${resolvedPort !== null}`);

  return {
    shouldStartBundler: resolvedPort !== null,
    port,
  };
}
