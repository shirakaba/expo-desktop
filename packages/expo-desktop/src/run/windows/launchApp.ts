import spawnAsync from "@expo/spawn-async";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CommandError } from "../../common/expo/error.ts";
import { ora } from "../../common/expo/ora.ts";

/**
 * Ask existing instances of a Windows desktop app to close and wait for their
 * processes to exit before the app is deployed and launched again.
 *
 * The helper sends a normal window-close request, rather than terminating the
 * processes. This gives the app an opportunity to save or reject the close.
 * Processes without top-level windows are treated as background/tray apps and
 * force-terminated because Windows has no generic graceful-close request for
 * them.
 * The PowerShell helper waits for the process Exited event, so a close that is
 * blocked by a confirmation dialog keeps the spinner waiting until the user
 * resolves the dialog instead of being silently forced or polled indefinitely.
 */
export async function waitForExistingInstancesToTerminateAsync(executableName: string) {
  const processName = path.parse(executableName).name;
  const scriptPath = fileURLToPath(new URL("../../../scripts/terminateApp.ps1", import.meta.url));
  const spinner = ora(`waiting for app ${processName} to terminate...`).start();

  try {
    await spawnAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-ProcessName",
      processName,
    ]);
  } catch (error: any) {
    const output = [error?.stderr, error?.stdout]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join("\n");
    const message = output || (error instanceof Error ? error.message : String(error));
    throw new CommandError(
      "WINDOWS_TERMINATE",
      `Failed to terminate existing instances of the Windows app ${processName}.\n\n${message}`,
    );
  } finally {
    spinner.stop();
  }
}
