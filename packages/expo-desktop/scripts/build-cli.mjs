#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function log(...args) {
  console.log("[expo-desktop build]", ...args);
}

log("starting");
log("package root:", pkgRoot);
log("process cwd:", process.cwd());
log("node:", process.version);

const configPath = path.join(pkgRoot, "tsconfig.build.json");
if (!fs.existsSync(configPath)) {
  console.error("[expo-desktop build] missing config:", configPath);
  process.exit(1);
}
log("tsconfig:", configPath);

let tscJs;
try {
  tscJs = require.resolve("typescript/lib/tsc.js");
} catch (cause) {
  console.error("[expo-desktop build] could not resolve typescript/lib/tsc.js (is typescript installed?)");
  console.error(cause);
  process.exit(1);
}
log("tsc entry:", tscJs);

const tsPkgPath = path.join(path.dirname(tscJs), "..", "package.json");
try {
  const { version: tsVersion } = JSON.parse(fs.readFileSync(tsPkgPath, "utf8"));
  log("typescript package version:", tsVersion);
} catch {
  log("(could not read typescript package.json)");
}

const tscArgs = [
  tscJs,
  "--project",
  configPath,
  "--pretty",
  "--listEmittedFiles",
  "--diagnostics",
];
if (process.env.EXPO_DESKTOP_BUILD_EXPLAIN === "1") {
  log("EXPO_DESKTOP_BUILD_EXPLAIN=1 → adding --explainFiles");
  tscArgs.push("--explainFiles");
}

log("spawning:", [process.execPath, ...tscArgs].join(" "));
const result = spawnSync(process.execPath, tscArgs, {
  cwd: pkgRoot,
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : process.env.FORCE_COLOR },
});

if (result.error) {
  console.error("[expo-desktop build] spawn failed:", result.error);
  process.exit(1);
}

const code = result.status ?? 1;
log("tsc finished with exit code:", code);

const cliOut = path.join(pkgRoot, "build", "cli.js");
if (code === 0 && !fs.existsSync(cliOut)) {
  console.error("[expo-desktop build] expected output missing after success:", cliOut);
  process.exit(1);
}
if (code === 0) {
  log("ok:", cliOut);
}

process.exit(code);
