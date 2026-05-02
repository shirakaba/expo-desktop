import arg from "arg";
import fs from "node:fs";
import path from "node:path";

import { Log } from "../log.ts";

/**
 * Parse the first argument as a project directory.
 *
 * @returns valid project directory.
 */
export function getProjectRoot(args: arg.Result<arg.Spec>) {
  const projectRoot = path.resolve(args._[0] || ".");

  if (!fs.existsSync(projectRoot)) {
    Log.exit(`Invalid project root: ${projectRoot}`);
  }

  return projectRoot;
}
