import chalk from "chalk";
import path from "path";

import { directoryExistsSync } from "../../common/expo/dir.ts";
import * as Log from "../../common/expo/log.ts";

export function validateTemplatePlatforms({
  templateDirectory,
  platforms,
}: {
  templateDirectory: string;
  platforms: Array<"ios" | "android" | "macos" | "windows">;
}) {
  const existingPlatforms: Array<"ios" | "android" | "macos" | "windows"> = [];

  for (const platform of platforms) {
    if (directoryExistsSync(path.join(templateDirectory, platform))) {
      existingPlatforms.push(platform);
    } else {
      Log.warn(
        chalk`⚠️  Skipping platform ${platform}. Use a template that contains native files for ${platform} (./${platform}).`,
      );
    }
  }

  return existingPlatforms;
}
