import { log } from "@clack/prompts";
import { spawn, type SpawnOptions } from "node:child_process";
import { env } from "node:process";
import readline from "node:readline";

export async function promisifiedSpawn({
  command,
  args,
  options = {},
}: {
  command: string;
  args: Array<string>;
  options?: SpawnOptions;
}) {
  const cp = spawn(command, args, { env, ...options });

  const { stdout, stderr } = cp;
  if (
    stdout &&
    (Array.isArray(options?.stdio) ? options?.stdio.at(1) : options?.stdio) !== "inherit"
  ) {
    readline
      .createInterface({ input: stdout })
      .on("line", (line) => log.message(line, { spacing: 0 }));
  }
  if (
    stderr &&
    (Array.isArray(options?.stdio) ? options?.stdio.at(2) : options?.stdio) !== "inherit"
  ) {
    readline
      .createInterface({ input: stderr })
      .on("line", (line) => log.message(line, { spacing: 0 }));
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
