import { spawn } from "node:child_process";

export async function isInsideGitRepoAsync(projectPath: string) {
  try {
    await runGitAsync(projectPath, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
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
