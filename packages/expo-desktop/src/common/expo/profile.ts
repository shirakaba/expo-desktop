import chalk from "chalk";

import { env } from "./env.ts";

/**
 * Wrap a method and profile the time it takes to execute the method using `EXPO_PROFILE`.
 * Works best with named functions (i.e. not arrow functions).
 *
 * @param fn function to profile.
 * @param functionName optional function name to display in the profile output.
 */
export function profile<IArgs extends any[], T extends (...args: IArgs) => any>(
  fn: T,
  functionName: string = fn.name,
): T {
  if (!env.EXPO_PROFILE) {
    return fn;
  }

  const name = chalk.dim(`⏱  [profile] ${functionName || "unknown"}`);

  return ((...args: IArgs) => {
    console.time(name);
    const result = fn(...args);
    if (!(result instanceof Promise)) {
      console.timeEnd(name);
      return result;
    }
    return result.then(
      (value) => {
        console.timeEnd(name);
        return value;
      },
      (error) => {
        console.timeEnd(name);
        throw error;
      },
    );
  }) as T;
}
