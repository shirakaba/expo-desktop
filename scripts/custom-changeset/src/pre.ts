import { ExitError } from "@changesets/errors";
import { log } from "@clack/prompts";
import path from "node:path";

import { pre } from "./changeset-pre.ts";
import { getTemplatePackages } from "./template-packages.ts";

const monorepoRoot = path.resolve(import.meta.dirname, "../../..");
const [command, tag] = process.argv.slice(2);

if (command !== "enter" && command !== "exit") {
  log.error("Only enter or exit is accepted after pre");
  throw new ExitError(1);
}
if (command === "enter" && tag == null) {
  log.error("A tag must be passed when using pre enter");
  throw new ExitError(1);
}

const extraPackages = await getTemplatePackages(monorepoRoot);

if (command === "enter") await pre({ command, cwd: monorepoRoot, tag: tag!, extraPackages });
else await pre({ command, cwd: monorepoRoot, extraPackages });
