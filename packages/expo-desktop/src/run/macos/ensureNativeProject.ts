import fs from "node:fs";
import path from "node:path";

import { prebuild } from "../../prebuild/command.ts";

/** Ensure that the macOS native project exists, generating it when necessary. */
export async function ensureNativeProjectAsync(
  projectRoot: string,
  { install }: { install?: boolean },
): Promise<boolean> {
  const macosRoot = path.join(projectRoot, "macos");
  if (fs.existsSync(macosRoot)) {
    return true;
  }

  await prebuild({
    clean: false,
    "no-install": !install,
    npm: undefined,
    yarn: undefined,
    bun: undefined,
    pnpm: undefined,
    template: undefined,
    platform: "macos",
    "skip-dependency-update": undefined,
  });
  return false;
}
