import type { Task } from "@clack/prompts";

import { spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "node:process";
import readline from "node:readline";
import { stripVTControlCharacters } from "node:util";

/**
 * Clack {@link Task} that runs a subprocess; piped stdout/stderr lines are sent
 * through the task `message` callback (not `log.message`). Lines are also kept in
 * an interleaved buffer; on failure they are written under {@link debugLogDir} or
 * {@link SpawnOptions.cwd} or the current working directory.
 */
export function promisifiedSpawnTask({
  title,
  command,
  args,
  options = {},
  debugLogDir,
}: {
  title: string;
  command: string;
  args: Array<string>;
  options?: SpawnOptions;
  /** Directory for debug logs when spawn cwd is unset (e.g. create-expo-app). */
  debugLogDir?: string;
}): Task {
  return {
    title,
    task: (message) =>
      runPromisifiedSpawn({
        command,
        args,
        options,
        logLine: message,
        ...(debugLogDir !== undefined ? { debugLogDir } : {}),
      }),
  };
}

function runPromisifiedSpawn({
  command,
  args,
  options,
  logLine,
  debugLogDir,
}: {
  command: string;
  args: Array<string>;
  options: SpawnOptions;
  logLine: (line: string) => void;
  debugLogDir?: string;
}) {
  const stdioEffective = effectiveStdioForSpawnCapture(options.stdio) ?? options.stdio;
  const spawnOptions: SpawnOptions = {
    ...options,
    stdio: stdioEffective,
    env: envWithForcedColorIfPiped({ ...options, stdio: stdioEffective }),
  };

  const cp = spawn(command, args, spawnOptions);

  /** Interleaved stdout/stderr lines in arrival order (tagged for readability). */
  const lineBuffer: string[] = [];

  const pushLine = (stream: "stdout" | "stderr", line: string) => {
    lineBuffer.push(`${stream}\t${line}`);
    logLine(line);
  };

  const { stdout, stderr } = cp;
  const outMode = Array.isArray(spawnOptions.stdio) ? spawnOptions.stdio.at(1) : spawnOptions.stdio;
  const errMode = Array.isArray(spawnOptions.stdio) ? spawnOptions.stdio.at(2) : spawnOptions.stdio;

  if (stdout && outMode !== "inherit" && outMode !== "ignore") {
    readline.createInterface({ input: stdout }).on("line", (line) => pushLine("stdout", line));
  }
  if (stderr && errMode !== "inherit" && errMode !== "ignore") {
    readline.createInterface({ input: stderr }).on("line", (line) => pushLine("stderr", line));
  }

  let cpError: Error | null = null;
  cp.on("error", (error) => {
    if (!cpError) {
      cpError = error;
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  cp.on("close", (code, signal) => {
    void (async () => {
      if (!cpError && code === 0) {
        resolve();
        return;
      }

      const logDir = resolveDebugLogDir(spawnOptions, debugLogDir);
      const fileName = `expo-desktop-spawn-debug-${Date.now()}.log`;
      const absPath = path.join(logDir, fileName);

      const header = [
        "# Captured by expo-desktop when a subprocess failed",
        `command: ${shellQuote(command)} ${args.map(shellQuote).join(" ")}`,
        `cwd (spawn): ${spawnOptions.cwd !== undefined ? String(spawnOptions.cwd) : "(default)"}`,
        `debug log directory: ${logDir}`,
        `exit code: ${code === null ? "null" : code}`,
        `signal: ${signal === null ? "null" : signal}`,
        "---",
        "",
      ].join("\n");

      let wrotePath: string | undefined;
      try {
        await fs.mkdir(logDir, { recursive: true });
        const body =
          lineBuffer.length > 0
            ? lineBuffer.map((line) => stripVTControlCharacters(line)).join("\n")
            : "(no stdout/stderr lines were captured; streams may have been inherited or ignored.)";
        await fs.writeFile(absPath, `${header}${body}\n`, "utf-8");
        wrotePath = absPath;
      } catch (writeErr) {
        reject(
          new Error(
            `Exited with code ${code} (signal: ${signal}). Failed to write debug log to ${absPath}: ${
              writeErr instanceof Error ? writeErr.message : String(writeErr)
            }${cpError ? ` (${cpError.message})` : ""}`,
            cpError ? { cause: cpError } : writeErr instanceof Error ? { cause: writeErr } : {},
          ),
        );
        return;
      }

      reject(
        new Error(
          `Exited with code ${code} (signal: ${signal}). Captured subprocess output was saved for debugging:\n  ${wrotePath}` +
            (cpError ? `\nUnderlying error: ${cpError.message}` : ""),
          cpError ? { cause: cpError } : {},
        ),
      );
    })();
  });

  return promise;
}

function shellQuote(arg: string): string {
  if (/^[\w@%+=:,./-]+$/i.test(arg)) {
    return arg;
  }
  return `'${arg.replaceAll("'", `'\\''`)}'`;
}

function resolveDebugLogDir(options: SpawnOptions, debugLogDir?: string): string {
  if (debugLogDir !== undefined) {
    return path.resolve(process.cwd(), debugLogDir);
  }
  if (options.cwd !== undefined) {
    return path.resolve(process.cwd(), String(options.cwd));
  }
  return process.cwd();
}

/**
 * When stdout and stderr are both inherited from the parent, switch them to pipes
 * so we can buffer lines while still forwarding each line through {@link logLine}.
 */
function effectiveStdioForSpawnCapture(
  stdio: SpawnOptions["stdio"],
): SpawnOptions["stdio"] | undefined {
  if (stdio === "inherit") {
    return ["inherit", "pipe", "pipe"];
  }
  if (Array.isArray(stdio) && stdio[1] === "inherit" && stdio[2] === "inherit") {
    const head = stdio.slice(0, 1);
    const tail = stdio.slice(3);
    return [...head, "pipe", "pipe", ...tail] as SpawnOptions["stdio"];
  }
  return stdio;
}

/**
 * When stdio is piped, the child sees non-TTY streams and most color libraries
 * disable ANSI.
 */
function envWithForcedColorIfPiped(options: SpawnOptions | undefined): NodeJS.ProcessEnv {
  const stdio = options?.stdio;
  const stdoutMode = Array.isArray(stdio) ? stdio.at(1) : stdio;
  const stderrMode = Array.isArray(stdio) ? stdio.at(2) : stdio;
  const capturesOutput = stdoutMode !== "inherit" || stderrMode !== "inherit";

  const base = { ...env, ...options?.env };
  if (!capturesOutput || base.NO_COLOR !== undefined) {
    return base;
  }
  if (base.FORCE_COLOR !== undefined && base.FORCE_COLOR !== "") {
    return base;
  }
  return { ...base, FORCE_COLOR: "1" };
}

/** Gitignore glob for spawn debug logs. */
export const SPAWN_DEBUG_LOG_GLOB = "expo-desktop-spawn-debug*.log";
