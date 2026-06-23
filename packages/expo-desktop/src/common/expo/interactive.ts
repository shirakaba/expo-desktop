import { env } from "./env.ts";

/** @returns `true` if the process is interactive. */
export function isInteractive(): boolean {
  return !env.CI && process.stdout.isTTY;
}
