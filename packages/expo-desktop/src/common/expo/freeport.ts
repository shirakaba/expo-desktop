import net from "node:net";

import { getPID } from "./get-running-process.ts";

async function testHostPortAsync(port: number, host: string | null): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen({ port, host }, () => {
      server.once("close", () => {
        setTimeout(() => resolve(true), 0);
      });
      server.close();
    });
    server.once("error", (_error) => {
      setTimeout(() => resolve(false), 0);
    });
  });
}

export async function testPortAsync(port: number, hostnames?: (string | null)[]): Promise<boolean> {
  if (!hostnames?.length) {
    hostnames = [null];
  }
  for (const host of hostnames) {
    if (!(await testHostPortAsync(port, host))) {
      return false;
    }
  }

  // On Windows, a wildcard IPv6 bind can succeed while an existing IPv4
  // listener still owns the same port. Consult the OS listener table after
  // the bind probe so loopback and wildcard listeners are both detected.
  if (process.platform === "win32" && (await getPID(port)) !== null) {
    return false;
  }

  return true;
}

export async function freePortAsync(
  portStart: number,
  hostnames?: (string | null)[],
): Promise<number | null> {
  for (let port = portStart; port <= 65_535; port++) {
    if (await testPortAsync(port, hostnames)) {
      return port;
    }
  }
  return null;
}
