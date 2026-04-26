import fs from "node:fs/promises";
import path from "node:path";

import { PartialAppConfig } from "../src/app-config.ts";

const schema = PartialAppConfig.toJsonSchema();

// Some examples, with and without $id:
// - With:
//   - https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/app-config.json
//   - https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/bun-lock.json
//   - https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/circleciconfig.json
//   - https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/clang-format.json
// - Without:
//   - https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/tsconfig.json
(schema as typeof schema & { $id: string })["$id"] = "https://json.schemastore.org/expoot-app.json";

await fs.writeFile(
  path.resolve(import.meta.dirname, "../schemas/expoot-app-schema.json"),
  JSON.stringify(PartialAppConfig.toJsonSchema(), null, 2),
);
