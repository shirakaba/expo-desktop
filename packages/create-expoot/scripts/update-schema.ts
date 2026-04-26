import fs from "node:fs/promises";
import path from "node:path";

import { PartialAppConfig } from "../src/app-config.ts";

await fs.writeFile(
  path.resolve(import.meta.dirname, "../schemas/app-config.json"),
  JSON.stringify(PartialAppConfig.toJsonSchema(), null, 2),
);
