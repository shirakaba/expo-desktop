import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

/** True when the project root has its own `.git` (from create-expo-app's init). */
export async function hasProjectGitRepositoryAsync(projectPath: string) {
  try {
    await fs.lstat(path.join(projectPath, ".git"));
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

/** `git diff --cached --quiet` exits 1 when there are staged changes. */
export async function hasGitStagedChangesAsync(projectPath: string) {
  try {
    await runGitAsync(projectPath, ["diff", "--cached", "--quiet"]);
    return false;
  } catch {
    return true;
  }
}

function runGitAsync(projectPath: string, args: Array<string>) {
  return new Promise<void>((resolve, reject) => {
    const cp = spawn(`git ${args.join(" ")}`, {
      cwd: projectPath,
      shell: true,
      stdio: "ignore",
    });
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`git ${args.join(" ")} exited with code ${code ?? "null"}`));
    });
  });
}
