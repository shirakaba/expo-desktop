// import { shouldReduceLogs } from "../events.ts";
import { env } from "./env.ts";

/** @returns `true` if the process is interactive. */
export function isInteractive(): boolean {
  // return !shouldReduceLogs() && !env.CI && process.stdout.isTTY;
  return !env.CI && process.stdout.isTTY;
}
