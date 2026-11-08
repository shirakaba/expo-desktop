import fs from "node:fs/promises";
import path from "node:path";

/** Detect enclosing monorepos even when the new app isn't a workspace member yet. */
export async function findAncestorWorkspaceAsync(
  projectRoot: string,
): Promise<FindAncestorWorkspaceResult> {
  let directory = path.dirname(path.resolve(projectRoot));
  while (true) {
    const workspaceFile = path.join(directory, "pnpm-workspace.yaml");
    try {
      await fs.access(workspaceFile);
      return { type: "resolve", workspaceRoot: directory };
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        return {
          type: "reject",
          subtype: "failed to access pnpm workspace file",
          filePath: workspaceFile,
          error,
        };
      }
    }
    const manifestFile = path.join(directory, "package.json");
    let contents: string | undefined;
    try {
      contents = await fs.readFile(manifestFile, "utf8");
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        return {
          type: "reject",
          subtype: "failed to read ancestor manifest",
          filePath: manifestFile,
          error,
        };
      }
    }
    if (contents !== undefined) {
      let manifest: unknown;
      try {
        manifest = JSON.parse(contents);
      } catch (error) {
        return {
          type: "reject",
          subtype: "failed to parse ancestor manifest",
          filePath: manifestFile,
          error,
        };
      }
      if (manifest !== null && typeof manifest === "object" && "workspaces" in manifest) {
        const workspaces = manifest.workspaces;
        if (
          Array.isArray(workspaces) ||
          (workspaces !== null &&
            typeof workspaces === "object" &&
            "packages" in workspaces &&
            Array.isArray(workspaces.packages))
        ) {
          return { type: "resolve", workspaceRoot: directory };
        }
      }
    }

    const parent = path.dirname(directory);
    if (parent === directory) return { type: "resolve", workspaceRoot: null };
    directory = parent;
  }
}

type FindAncestorWorkspaceResult =
  | { type: "resolve"; workspaceRoot: string | null }
  | {
      type: "reject";
      subtype: "failed to access pnpm workspace file";
      filePath: string;
      error: unknown;
    }
  | {
      type: "reject";
      subtype: "failed to read ancestor manifest";
      filePath: string;
      error: unknown;
    }
  | {
      type: "reject";
      subtype: "failed to parse ancestor manifest";
      filePath: string;
      error: unknown;
    };
