import type { Package } from "@manypkg/tools";

import fs from "node:fs/promises";
import path from "node:path";

export async function getTemplatePackages(monorepoRoot: string): Promise<Array<Package>> {
  const templates = new Array<Package>();

  for await (const { name, parentPath } of fs.glob("templates/*/*/package.json", {
    cwd: monorepoRoot,
    withFileTypes: true,
  })) {
    const packageJsonRaw = await fs.readFile(path.join(parentPath, name), "utf-8");
    const packageJson = JSON.parse(packageJsonRaw);
    const relativeDir = path.relative(monorepoRoot, parentPath);

    templates.push({ dir: parentPath, relativeDir, packageJson });
  }

  return templates;
}
