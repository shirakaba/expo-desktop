import chalk from "chalk";
import {
  execFileSync,
  execSync,
  type ExecFileSyncOptionsWithStringEncoding,
  type ExecSyncOptionsWithStringEncoding,
} from "node:child_process";
import net from "node:net";
import path from "node:path";

import { env } from "./env.ts";
import { CommandError } from "./error.ts";
import { isInteractive } from "./interactive.ts";
import * as Log from "./log.ts";
import { confirmAsync } from "./prompts-cli.ts";

const DEFAULT_PORT = 8081;
const MAX_PORT = 65_535;

const execOptions: ExecSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  stdio: ["pipe", "pipe", "ignore"],
};
const execFileOptions: ExecFileSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  stdio: ["pipe", "pipe", "ignore"],
};

/** Whether the port is in the usable range. Port 0 means "pick any available port". */
export function isValidPort(port: number | undefined): port is number {
  return port !== undefined && Number.isInteger(port) && port >= 0 && port <= MAX_PORT;
}

/** @returns `true` when the port is available for a new server. */
export async function isPortAvailableAsync(port: number): Promise<boolean> {
  if (!isValidPort(port)) {
    return false;
  }

  const hosts = port === 0 ? [undefined] : ["127.0.0.1", "::1"];
  for (const host of hosts) {
    const available = await isPortAvailableOnHostAsync(port, host);
    if (!available) {
      return false;
    }
  }
  return true;
}

function isPortAvailableOnHostAsync(port: number, host: string | undefined): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    if (host) {
      server.listen(port, host);
    } else {
      server.listen(port);
    }
  });
}

/** Get a free port at or after the requested port. */
export async function getFreePortAsync(rangeStart: number = DEFAULT_PORT): Promise<number> {
  const firstPort =
    Number.isInteger(rangeStart) && rangeStart > 0 ? Math.min(rangeStart, MAX_PORT) : DEFAULT_PORT;
  for (let port = firstPort; port <= MAX_PORT; port++) {
    if (await isPortAvailableAsync(port)) {
      return port;
    }
  }

  throw new CommandError("NO_PORT_FOUND", "No available port found");
}

/**
 * Pick a usable Metro port, reusing a server for this project when requested.
 * This follows the port-selection flow used by Expo CLI's iOS runner.
 */
export async function choosePortAsync(
  projectRoot: string,
  {
    defaultPort,
    reuseExistingPort = false,
    explicitPort = false,
  }: {
    defaultPort: number;
    reuseExistingPort?: boolean;
    /** Whether the requested port was explicitly supplied by the user. */
    explicitPort?: boolean;
  },
): Promise<number | null> {
  if (defaultPort === 0) {
    return getFreePortAsync();
  }

  if (await isPortAvailableAsync(defaultPort)) {
    return defaultPort;
  }

  const runningProcess = getRunningProcess(defaultPort);
  if (runningProcess?.directory === path.resolve(projectRoot) && reuseExistingPort) {
    return null;
  }

  const nextPort = await getFreePortAsync(defaultPort + 1);
  let message = `Port ${chalk.bold(defaultPort)} is`;
  if (runningProcess) {
    message += ` running ${chalk.cyan(runningProcess.command)} in another window`;
    message += `\n${chalk.gray(`  ${runningProcess.directory} (pid ${runningProcess.pid})`)}`;
  } else {
    message += " being used by another process";
  }

  Log.log(`› ${message}`);

  if (!isInteractive()) {
    if (explicitPort) {
      throw new CommandError(
        "PORT_IN_USE",
        `Port ${defaultPort} is unavailable and 'npx expo' is running in non-interactive mode, so it can't prompt to use another port. Free port ${defaultPort} by stopping the process using it, or re-run with an available '--port'.`,
      );
    }

    Log.log(`› Using port ${nextPort} instead`);
    return nextPort;
  }

  const change = await confirmAsync({
    message: `Use port ${nextPort} instead?`,
    initial: true,
  });
  return change ? nextPort : null;
}

/**
 * Resolve the Metro port and write it back to RCT_METRO_PORT for React Native's
 * native build scripts. A requested port of 0 is replaced with a concrete free
 * port before the native build starts.
 */
export async function resolvePortAsync(
  projectRoot: string,
  {
    reuseExistingPort = false,
    defaultPort,
    fallbackPort,
  }: {
    reuseExistingPort?: boolean;
    defaultPort?: number;
    fallbackPort?: number;
  } = {},
): Promise<number | null> {
  const requestedPort = isValidPort(defaultPort) ? defaultPort : undefined;
  const environmentPort = isValidPort(env.RCT_METRO_PORT) ? env.RCT_METRO_PORT : undefined;
  const preferredPort =
    requestedPort ??
    environmentPort ??
    (isValidPort(fallbackPort) && fallbackPort > 0 ? fallbackPort : DEFAULT_PORT);

  const port =
    preferredPort === 0
      ? await getFreePortAsync(environmentPort || fallbackPort || DEFAULT_PORT)
      : preferredPort;
  const resolvedPort = await choosePortAsync(projectRoot, {
    defaultPort: port,
    reuseExistingPort,
    explicitPort: requestedPort !== undefined && requestedPort !== 0,
  });

  if (resolvedPort == null) {
    Log.log("› Skipping dev server");
  } else {
    process.env.RCT_METRO_PORT = String(resolvedPort);
  }

  return resolvedPort;
}

type RunningProcess = {
  pid: number;
  directory: string;
  command: string;
};

function getRunningProcess(port: number): RunningProcess | null {
  // lsof is available on macOS, which is the platform this runner targets.
  // Windows keeps the previous best-effort behavior for the shared helper.
  if (process.platform !== "darwin") {
    return null;
  }

  const pid = getPID(port);
  if (!pid) {
    return null;
  }

  try {
    const directory = execSync(
      `lsof -p ${pid} | awk '$4=="cwd" {for (i=9; i<=NF; i++) printf "%s ", $i}'`,
      execOptions,
    ).trim();
    const command = execFileSync(
      "ps",
      ["-o", "command=", "-p", String(pid)],
      execFileOptions,
    ).trim();
    if (!directory) {
      return null;
    }
    return { pid, directory: path.resolve(directory), command: command || "another process" };
  } catch {
    return null;
  }
}

function getPID(port: number): number | null {
  try {
    const result = execFileSync("lsof", [`-i:${port}`, "-P", "-t", "-sTCP:LISTEN"], execFileOptions)
      .split("\n")[0]
      ?.trim();
    const pid = Number(result);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Ensure that the port has not become busy during the native build.
 *
 * If the port was taken by this project's Metro server while the native build
 * was running, reuse that server. A port taken by another process is an error so
 * the app cannot be pointed at an unrelated bundler.
 */
export async function ensurePortAvailabilityAsync(
  projectRoot: string,
  { port }: { port: number },
): Promise<boolean> {
  if (await isPortAvailableAsync(port)) {
    return true;
  }

  const runningProcess = getRunningProcess(port);
  if (!runningProcess && process.platform !== "darwin") {
    Log.log(
      "› The dev server for this app is already running in another window. Logs will appear there.",
    );
    return false;
  }
  if (runningProcess?.directory !== path.resolve(projectRoot)) {
    throw new CommandError(
      "PORT_IN_USE",
      `Port "${port}" became busy running another process while the app was compiling. Re-run command to use a new port.`,
    );
  }

  Log.log(
    "› The dev server for this app is already running in another window. Logs will appear there.",
  );
  return false;
}
