import path from "node:path";

import { publish } from "./changeset-publish.ts";
import { publishDryRun } from "./publish-dry-run.ts";
import { getTemplatePackages } from "./template-packages.ts";

const monorepoRoot = path.resolve(import.meta.dirname, "../../..");
const extraPackages = await getTemplatePackages(monorepoRoot);

if (process.argv.includes("--dry-run")) {
  await publishDryRun({ cwd: monorepoRoot, extraPackages });
} else {
  await publish({ cwd: monorepoRoot, extraPackages });
}
