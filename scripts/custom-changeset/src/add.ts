import path from "node:path";

import { add } from "./changeset-add.ts";
import { getTemplatePackages } from "./template-packages.ts";

const monorepoRoot = path.resolve(import.meta.dirname, "../../..");

await add({
  cwd: monorepoRoot,
  extraPackages: await getTemplatePackages(monorepoRoot),
});
