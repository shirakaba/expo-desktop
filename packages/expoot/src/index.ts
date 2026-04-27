import fs from "node:fs/promises";
import path from "node:path";
import { cwd } from "node:process";

// TODO: Use ArkType to generate the JSON schema to upload to schemastore
await fs.writeFile(
  path.resolve(cwd(), "expoot-app.json"),
  `
{
  "$schema": "https://json.schemastore.org/expoot-app.json",

  "name": {
    "alphanumeric": "MyApp123",
    "display_name": "My App 123",
    "reverse_dns": "com.example.my-app-123"
  },
}
`.trimStart(),
);
