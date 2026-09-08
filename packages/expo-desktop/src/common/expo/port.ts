import net from "node:net";

import * as Log from "./log.ts";

/** @returns `true` when the port is available for a new server. */
export async function isPortAvailableAsync(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

/**
 * Ensure that the port has not become busy during the native build.
 *
 * Expo CLI distinguishes between a port used by this project and a port used by
 * another project. The desktop runner cannot reliably identify the owning Metro
 * process without pulling in Expo CLI's process inspection internals, so a busy
 * port is treated as an already-running dev server, which is the safe behavior
 * for a host-only target.
 */
export async function ensurePortAvailabilityAsync(
  _projectRoot: string,
  { port }: { port: number },
): Promise<boolean> {
  if (await isPortAvailableAsync(port)) {
    return true;
  }

  Log.log(
    "› The dev server for this app is already running in another window. Logs will appear there.",
  );
  return false;
}
