import * as Log from "./log.ts";
import { isPortAvailableAsync } from "./port.ts";

export interface BundlerProps {
  /** Port to start the dev server on. */
  port: number;
  /** Skip opening the bundler from the native script. */
  shouldStartBundler: boolean;
}

export async function resolveBundlerPropsAsync(
  _projectRoot: string,
  options: { port?: number; bundler?: boolean },
): Promise<BundlerProps> {
  const shouldStartBundler = options.bundler ?? true;
  const port = options.port ?? 8081;

  if (!shouldStartBundler) {
    Log.debug(`Resolved port: ${port}, start dev server: false`);
    return { shouldStartBundler: false, port };
  }

  // A running Metro instance can be reused. The native build still receives the
  // selected port so its debug bundle points to the same server.
  const resolvedShouldStartBundler = await isPortAvailableAsync(port);
  Log.debug(`Resolved port: ${port}, start dev server: ${resolvedShouldStartBundler}`);

  return {
    shouldStartBundler: resolvedShouldStartBundler,
    port,
  };
}
