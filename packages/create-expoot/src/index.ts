import fs from "node:fs/promises";
import path from "node:path";
import { cwd } from "node:process";

// This would be ideal to run against, but as the user won't have create-expoot
// in their immediate node_modules, it won't give any Intellisense.
//
// Would JSON Schema be better? Or should we go back to TOML?
// ... Or should we inline the types? Is that even possible with ArkType?
await fs.writeFile(
  path.resolve(cwd(), "create-expoot-config.mts"),
  `
import { defineConfig } from "create-expoot";

const config = defineConfig({
  name: {
    alphanumeric: "MyApp123",
    display_name: "My App 123",
    reverse_dns: "com.example.my-app-123",
  },
});
export default config;
`.trimStart(),
);
