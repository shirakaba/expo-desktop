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

  const parsedPort = options.port === undefined ? null : parseInt(options.port, 10);
  if (typeof parsedPort === "number" && !isValidPort(parsedPort)) {
    throw new CommandError("BAD_ARGS", `Expected port to be a number, but got ${options.port}.`);
  }

  let port = shouldStartBundler
    ? await resolveMetroPortAsync(projectRoot, {
        reuseExistingPort: true,
        ...(parsedPort !== null ? { defaultPort: parsedPort } : {}),
      })
    : null;

  // Skip bundling if the port is null -- meaning skip the bundler if the port
  // is already running the app.
  options.bundler = !!port;
  if (!port) {
    // Use a valid user-provided port, or the default port
    port = isValidPort(parsedPort) ? parsedPort : 8081;
    if (shouldStartBundler) {
      // resolveMetroPortAsync returns null when it finds this project's Metro server.
      // Pass that server's port to the React Native Windows CLI through RCT_METRO_PORT.
      // --no-bundler must leave RCT_METRO_PORT unchanged.
      process.env.RCT_METRO_PORT = String(port);
    }
  }
  Log.debug(`Resolved port: ${port}, start dev server: ${options.bundler}`);

  return {
    shouldStartBundler: !!options.bundler,
    port,
  };
}
