import spawnAsync from "@expo/spawn-async";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/** Timeout applied to shell commands */
const timeout = 350;
const windowsProcessInfoTimeout = 5_000;

type WindowsProcessInfo = {
  directory: string | null;
  command: string | null;
};

/** Returns a pid value for a running port like `63828` or null if nothing is running on the given port. */
export async function getPID(port: number): Promise<number | null> {
  if (process.platform === "win32") {
    return getWindowsPIDAsync(port);
  }

  try {
    const { stdout } = await spawnAsync("lsof", [`-i:${port}`, "-P", "-t", "-sTCP:LISTEN"], {
      timeout,
    });
    const pid = Number(stdout.split("\n", 1)[0]!.trim());
    if (Number.isSafeInteger(pid)) {
      // event("port_pid", { port, pid });
      return pid;
    }
    return null;
  } catch (error: any) {
    // event("port_pid_failed", { port, error: event.error(error as Error) });
    return null;
  }
}

/** Return the PID listening on a TCP port on Windows. */
async function getWindowsPIDAsync(port: number): Promise<number | null> {
  try {
    const { stdout } = await spawnAsync("netstat.exe", ["-ano", "-p", "tcp"], {
      timeout,
    });

    for (const line of stdout.split(/\r?\n/)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 5 || columns[0]!.toUpperCase() !== "TCP") {
        continue;
      }

      const localAddress = columns[1]!;
      const localPort = Number.parseInt(localAddress.slice(localAddress.lastIndexOf(":") + 1), 10);
      const pid = Number.parseInt(columns[4]!, 10);
      if (columns[3]!.toUpperCase() === "LISTENING" && localPort === port) {
        return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
      }
    }
  } catch {}

  return null;
}

/** Get `package.json` `name` field for a given directory. Returns `null` if none exist. */
function getPackageName(packageRoot: string): string | null {
  try {
    const packageJson = path.resolve(packageRoot, "package.json");
    return require(packageJson).name || null;
  } catch (error) {
    return null;
  }
}

/** Returns a command like `node /Users/evanbacon/.../bin/expo start` or the package.json name. */
export async function getProcessCommand(
  pid: number,
  procDirectory: string,
): Promise<string | null> {
  let name = getPackageName(procDirectory);
  if (process.platform === "win32") {
    name ??= (await getWindowsProcessInfoAsync(pid))?.command ?? null;
    return name || null;
  }

  if (!name) {
    // ps
    // -o args=: Output argv without header
    // -p [pid]: For process of PID
    const { stdout } = await spawnAsync("ps", ["-o", "args=", "-p", `${pid}`], {
      timeout,
    });
    name = stdout.trim();
  }
  return name || null;
}

/** Get directory for a given process ID. */
export async function getDirectoryOfProcessById(pid: number): Promise<string | null> {
  if (process.platform === "win32") {
    // Test servers created in-process do not need a PEB lookup.
    if (pid === process.pid) {
      return process.cwd();
    }
    return (await getWindowsProcessInfoAsync(pid))?.directory ?? null;
  }

  try {
    // lsof
    // -F n: ask for machine readable output
    // -a: apply conditions as logical AND
    // -d cwd: Filter by cwd fd
    // -p [pid]: Filter by input process id
    const { stdout } = await spawnAsync("lsof", ["-F", "n", "-a", "-d", "cwd", "-p", `${pid}`], {
      timeout,
    });
    const processCWD = stdout
      .split("\n")
      .find((output) => output.startsWith("n"))
      ?.slice(1);
    return processCWD && path.isAbsolute(processCWD) ? path.normalize(processCWD) : null;
  } catch {
    return null;
  }
}

async function getWindowsProcessInfoAsync(pid: number): Promise<WindowsProcessInfo | null> {
  const scriptPath = fileURLToPath(new URL("../../../scripts/getProcessInfo.ps1", import.meta.url));

  try {
    const { stdout } = await spawnAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-ProcessId",
        String(pid),
      ],
      { timeout: windowsProcessInfoTimeout },
    );
    const result = JSON.parse(stdout.trim()) as Partial<WindowsProcessInfo>;
    const directory =
      typeof result.directory === "string" && result.directory.length > 0
        ? path.resolve(result.directory)
        : null;
    const command = typeof result.command === "string" ? result.command.trim() || null : null;
    return { directory, command };
  } catch {
    return null;
  }
}

interface RunningProcess {
  /** The PID value for the port. */
  pid: number;
  /** Get the directory for the running process. */
  directory: string;
  /** The command running the process like `node /Users/evanbacon/.../bin/expo start` or the `package.json` name like `my-app`. */
  command: string;
}

/** Get information about a running process given a port. Returns null if no process is running on the given port. */
export async function getRunningProcess(port: number): Promise<RunningProcess | null> {
  const pid = await getPID(port);
  if (!pid) {
    return null;
  }
  try {
    const directory = await getDirectoryOfProcessById(pid);
    if (directory) {
      const command = await getProcessCommand(pid, directory);
      if (command) {
        return { pid, directory, command };
      }
    }
  } catch {}
  return null;
}
