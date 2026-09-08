import chalk from "chalk";
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";

import * as Log from "./log.ts";

const require = createRequire(import.meta.url);

export type DevServerManager = {
  stopAsync(): Promise<void>;
};

/**
 * Start Metro through the app's installed Expo CLI.
 *
 * The Metro server is deliberately kept in a child process. This preserves the
 * same process boundary as `expo run ios` while keeping Expo CLI out of
 * expo-desktop's runtime dependencies; the command remains a vendored fork of
 * the orchestration around it.
 */
export async function startBundlerAsync(
  projectRoot: string,
  {
    port,
    headless,
    scheme,
    mode,
  }: {
    port: number;
    headless?: boolean;
    scheme?: string;
    mode: "development" | "production";
  },
): Promise<DevServerManager> {
  let expoCliPath: string;
  try {
    expoCliPath = require.resolve("expo/bin/cli", { paths: [projectRoot] });
  } catch {
    throw new Error(
      `Could not find Expo CLI in ${path.join(projectRoot, "node_modules")}. Install the app dependencies before starting the bundler.`,
    );
  }

  const args = [expoCliPath, "start", "--dev-client", "--localhost", "--port", String(port)];
  if (scheme) {
    args.push("--scheme", scheme);
  }
  if (mode === "production") {
    args.push("--no-dev");
  }
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      RCT_METRO_PORT: String(port),
    },
    stdio: "inherit",
  });

  try {
    await waitForPortAsync(port, child);
  } catch (error) {
    await stopProcessAsync(child);
    throw error;
  }

  if (!headless) {
    Log.log(chalk`Waiting on {underline http://localhost:${port}}`);
  }

  return {
    async stopAsync() {
      await stopProcessAsync(child);
    },
  };
}

async function waitForPortAsync(port: number, child: ChildProcess): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`Expo CLI exited before Metro started (exit code ${child.exitCode}).`);
    }
    if (await isPortOpenAsync(port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Metro did not start on port ${port} within 30 seconds.`);
}

function isPortOpenAsync(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function stopProcessAsync(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    child.once("close", () => resolve());
    child.kill("SIGTERM");
  });
}
