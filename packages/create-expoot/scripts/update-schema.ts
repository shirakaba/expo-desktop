import fs from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

import { PartialAppConfig } from "../src/app-config.ts";

console.log(inspect(PartialAppConfig.toJsonSchema(), { depth: null }));
