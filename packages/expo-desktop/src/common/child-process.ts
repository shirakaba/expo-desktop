import type { Task } from "@clack/prompts";
import { spawn, type SpawnOptions } from "node:child_process";
import { env } from "node:process";
import readline from "node:readline";

/**
 * Clack {@link Task} that runs a subprocess; piped stdout/stderr lines are sent
 * through the task `message` callback (not `log.message`).
 */
export function promisifiedSpawnTask({
  title,
  command,
  args,
  options = {},
}: {
  title: string;
  command: string;
  args: Array<string>;
  options?: SpawnOptions;
}): Task {
  return {
    title,
    task: (message) =>
      runPromisifiedSpawn({
        command,
        args,
        options,
        logLine: message,
      }),
  };
}

function runPromisifiedSpawn({
  command,
  args,
  options,
  logLine,
}: {
  command: string;
  args: Array<string>;
  options: SpawnOptions;
  logLine: (line: string) => void;
}) {
  const cp = spawn(command, args, {
    ...options,
    env: envWithForcedColorIfPiped(options),
  });

  const { stdout, stderr } = cp;
  if (
    stdout &&
    (Array.isArray(options?.stdio) ? options?.stdio.at(1) : options?.stdio) !== "inherit"
  ) {
    readline.createInterface({ input: stdout }).on("line", logLine);
  }
  if (
    stderr &&
    (Array.isArray(options?.stdio) ? options?.stdio.at(2) : options?.stdio) !== "inherit"
  ) {
    readline.createInterface({ input: stderr }).on("line", logLine);
  }

  let cpError: Error | null = null;
  cp.on("error", (error) => {
    if (!cpError) {
      cpError = error;
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  cp.on("close", (code, signal) => {
    if (cpError || code !== 0) {
      reject(
        new Error(`Exited with code ${code} (signal ${signal})`, cpError ? { cause: cpError } : {}),
      );
      return;
    }

    resolve();
  });

  return promise;
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
