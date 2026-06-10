import type { ExpoConfig } from "@expo/config";

import { log } from "@clack/prompts";
import { modifyConfigAsync } from "@expo/config";
import { default as kleur } from "kleur";
import * as process from "node:process";

/** Wraps `[@expo/config] modifyConfigAsync()` and adds additional logging. */
export async function attemptModification(
  projectRoot: string,
  edits: Partial<ExpoConfig>,
  exactEdits: Partial<ExpoConfig>,
): Promise<boolean> {
  const modification = await modifyConfigAsync(projectRoot, edits, {
    skipSDKVersionRequirement: true,
  });
  if (modification.type !== "success") {
    warnAboutConfigAndThrow(modification.type, modification.message!, exactEdits);
  }
  return modification.type === "success";
}

export function warnAboutConfigAndThrow(type: string, message: string, edits: Partial<ExpoConfig>) {
  log.message();
  if (type === "warn") {
    // The project is using a dynamic config, give the user a helpful log and bail out.
    log.message(kleur.yellow(message));
  }
  notifyAboutManualConfigEdits(edits);
  process.exit(1);
}

function notifyAboutManualConfigEdits(edits: Partial<ExpoConfig>) {
  log.message(kleur.cyan(`Add the following to your Expo config`));
  log.message();
  log.message(JSON.stringify(edits, null, 2));
  log.message();
}
