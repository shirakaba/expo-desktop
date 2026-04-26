import fs from "node:fs/promises";
import path from "node:path";
import { cwd } from "node:process";

// TODO: Use ArkType to generate the JSON schema to upload to schemastore
await fs.writeFile(
  path.resolve(cwd(), "create-expoot-config.json"),
  `
{
  "$schema": "https://www.schemastore.org/create-expoot-config",
  "_version": "0.1.0",

  "name": {
    "alphanumeric": "MyApp123",
    "display_name": "My App 123",
    "reverse_dns": "com.example.my-app-123"
  },
}
`.trimStart(),
);
