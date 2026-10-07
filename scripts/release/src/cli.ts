import path from "node:path";
import { parseArgs } from "node:util";

import { runRelease } from "./release.ts";

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { "dry-run": { type: "boolean" }, since: { type: "string" } },
  });
  const [command] = positionals;
  if (
    positionals.length !== 1 ||
    !["check", "mode", "version", "publish"].includes(command ?? "") ||
    (values["dry-run"] && command !== "publish") ||
    (values.since && command !== "check")
  ) {
    throw new Error("Usage: release check [--since REF] | mode | version | publish [--dry-run]");
  }
  await runRelease(command as "check" | "mode" | "version" | "publish", {
    cwd: path.resolve(import.meta.dirname, "../../.."),
    dryRun: values["dry-run"],
    since: values.since,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
