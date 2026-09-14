import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";

import * as Log from "../common/expo/log.ts";

/** Copy the built binary to the specified output directory. */
export async function copyBinaryToOutputAsync(
  binaryPath: string,
  outputDir: string,
): Promise<string> {
  const absoluteOutputDir = path.resolve(outputDir);
  const appName = path.basename(binaryPath);
  const outputPath = path.join(absoluteOutputDir, appName);

  // Create the output directory if it doesn't exist.
  await fs.promises.mkdir(absoluteOutputDir, { recursive: true });

  // Copy the .app bundle to the output directory.
  await fs.promises.cp(binaryPath, outputPath, { recursive: true });

  Log.log(chalk`{dim Copied to} ${outputPath}`);

  return outputPath;
}
