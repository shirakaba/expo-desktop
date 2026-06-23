import chalk from "chalk";

import { env } from "./env.ts";
import { ExitError } from "./error.ts";

// NOTE(@kitten): LogRespectingTerminal in instantiateMetro regressed on fatal errors and
// logs may be swallowed before exiting. We redirect them to a direct write when we're about to exit
let isExiting = false;

export function error(...message: string[]): void {
  console.error(...message);
}

/** Print an error and provide additional info (the stack trace) in debug mode. */
export function exception(e: Error): void {
  error(chalk.red(e.toString()) + (env.EXPO_DEBUG ? "\n" + chalk.gray(e.stack) : ""));
}

export function warn(...message: string[]): void {
  if (isExiting) {
    process.stderr.write(message.map((value) => chalk.yellow(value)).join(" ") + "\n");
    return;
  }
  console.warn(...message.map((value) => chalk.yellow(value)));
}

export function log(...message: string[]): void {
  console.log(...message);
}

/** Log a message and exit the current process. If the `code` is non-zero then `console.error` will be used instead of `console.log`. */
export function exit(message: string | Error, code: number = 1): never {
  if (message instanceof Error) {
    exception(message);
  } else if (message) {
    if (code === 0) {
      log(message);
    } else {
      error(message);
    }
  }

  if (code !== 0) {
    throw new ExitError(message, code);
  }
  process.exit(code);
}

// The re-export makes auto importing easier.
export const Log = {
  error,
  exception,
  log,
  exit,
};
