import net from "node:net";
import { afterEach, expect, test } from "vitest";

import { resolveBundlerPropsAsync } from "./resolve-bundler-props.ts";

const originalMetroPort = process.env.RCT_METRO_PORT;

afterEach(() => {
  if (originalMetroPort === undefined) {
    delete process.env.RCT_METRO_PORT;
  } else {
    process.env.RCT_METRO_PORT = originalMetroPort;
  }
});

test("does not inspect or start Metro when bundling is disabled", async () => {
  delete process.env.RCT_METRO_PORT;

  await expect(
    resolveBundlerPropsAsync(process.cwd(), {
      bundler: false,
    }),
  ).resolves.toStrictEqual({
    shouldStartBundler: false,
    port: 8081,
  });
});

test("rejects an explicitly supplied port with --no-bundler, including port 0", async () => {
  await expect(
    resolveBundlerPropsAsync(process.cwd(), {
      bundler: false,
      port: 0,
    }),
  ).rejects.toMatchObject({
    code: "BAD_ARGS",
  });
});

test("uses RCT_METRO_PORT when no explicit port is supplied", async () => {
  const port = await getFreePortAsyncForTest();
  process.env.RCT_METRO_PORT = String(port);

  await expect(
    resolveBundlerPropsAsync(process.cwd(), {
      bundler: true,
    }),
  ).resolves.toStrictEqual({
    shouldStartBundler: true,
    port,
  });
  expect(process.env.RCT_METRO_PORT).toBe(String(port));
});

test("resolves port 0 to a concrete free port and reports it through RCT_METRO_PORT", async () => {
  delete process.env.RCT_METRO_PORT;

  const result = await resolveBundlerPropsAsync(process.cwd(), {
    bundler: true,
    port: 0,
  });

  expect(result.shouldStartBundler).toBe(true);
  expect(result.port).toBeGreaterThan(0);
  expect(process.env.RCT_METRO_PORT).toBe(String(result.port));
});

test("reuses a Metro server already listening for this project", async () => {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not expose a TCP port");
  }

  try {
    await expect(
      resolveBundlerPropsAsync(process.cwd(), {
        bundler: true,
        port: address.port,
      }),
    ).resolves.toStrictEqual({
      shouldStartBundler: false,
      port: address.port,
    });
    expect(process.env.RCT_METRO_PORT).toBe(String(address.port));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

async function getFreePortAsyncForTest(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Test server did not expose a TCP port");
  }

  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
