import path from "node:path";

import { version } from "./changeset-version.ts";
import { getTemplatePackages } from "./template-packages.ts";

const monorepoRoot = path.resolve(import.meta.dirname, "../../..");

await version({
  cwd: monorepoRoot,
  extraPackages: await getTemplatePackages(monorepoRoot),
});
