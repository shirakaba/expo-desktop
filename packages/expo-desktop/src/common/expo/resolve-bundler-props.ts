import { env } from "./env.ts";
import { CommandError } from "./error.ts";
import * as Log from "./log.ts";
import { isValidPort, resolveMetroPortAsync } from "./port.ts";

export interface BundlerProps {
  /** Port to start the dev server on. */
  port: number;
  /** Skip opening the bundler from the native script. */
  shouldStartBundler: boolean;
}

export async function resolveBundlerPropsAsync(
  projectRoot: string,
  options: { port?: string; bundler?: boolean },
): Promise<BundlerProps> {
  const shouldStartBundler = options.bundler ?? true;

  if (!shouldStartBundler && options.port !== undefined) {
    throw new CommandError("BAD_ARGS", "--port and --no-bundler are mutually exclusive arguments");
  }

  const parsedPort = options.port === undefined ? undefined : parseInt(options.port, 10);
  if (!isValidPort(parsedPort)) {
    throw new CommandError("BAD_ARGS", `Expected port to be a number, but got ${options.port}.`);
  }

  let port = shouldStartBundler
    ? await resolveMetroPortAsync(projectRoot, {
        reuseExistingPort: true,
        ...(parsedPort !== undefined ? { defaultPort: parsedPort } : {}),
      })
    : null;

  // Skip bundling if the port is null -- meaning skip the bundler if the port
  // is already running the app.
  options.bundler = !!port;
  if (!port) {
    // Use a valid user-provided port, or the default port
    port = parsedPort;
  }
  Log.debug(`Resolved port: ${port}, start dev server: ${options.bundler}`);

  return {
    shouldStartBundler: !!options.bundler,
    port,
  };
}
