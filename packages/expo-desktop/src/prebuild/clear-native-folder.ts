import { log, tasks } from "@clack/prompts";
import fs from "node:fs/promises";
import path from "node:path";

export async function clearNativeFolder(projectRoot: string, folders: string[]) {
  try {
    await tasks([
      {
        title: `Clearing ${folders.join(", ")}`,
        task: async (_message) => {
          await Promise.all(
            folders.map((folderName) =>
              fs.rm(path.join(projectRoot, folderName), { recursive: true, force: true }),
            ),
          );
        },
      },
    ]);
  } catch (cause) {
    throw new Error(`Failed to delete ${folders.join(", ")}`, { cause });
  }
}
