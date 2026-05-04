#!/usr/bin/env node

/**
 * Writes every line to:
 * - stderr (unbuffered) so local terminals and some CI runners show it
 * - packages/expo-desktop/expo-desktop-build.log so CI can `cat` it after a failed
 *   `npm publish --json` (Changesets uses --json; npm often hides lifecycle stdout).
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(pkgRoot, "expo-desktop-build.log");

try {
  fs.unlinkSync(logPath);
} catch {
  // ignore
}

function emit(line) {
  const text = `${line}\n`;
  try {
    fs.appendFileSync(logPath, text, "utf8");
  } catch {
    // still try stderr
  }
  try {
    fs.writeSync(2, text);
  } catch {
    // ignore EPIPE etc.
  }
}

function log(...args) {
  emit(`[expo-desktop build] ${args.join(" ")}`);
}

log("starting");
log("package root:", pkgRoot);
log("process cwd:", process.cwd());
log("node:", process.version);
log("log file:", logPath);
log("npm_lifecycle_event:", process.env.npm_lifecycle_event ?? "(unset)");
log("npm_command:", process.env.npm_command ?? "(unset)");
log("npm_lifecycle_script:", process.env.npm_lifecycle_script ?? "(unset)");

const configPath = path.join(pkgRoot, "tsconfig.build.json");
if (!fs.existsSync(configPath)) {
  emit(`[expo-desktop build] missing config: ${configPath}`);
  process.exit(1);
}
log("tsconfig:", configPath);

let tscJs;
try {
  tscJs = require.resolve("typescript/lib/tsc.js");
} catch (cause) {
  emit(`[expo-desktop build] could not resolve typescript/lib/tsc.js (is typescript installed?)`);
  emit(String(cause));
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
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : process.env.FORCE_COLOR },
});

if (result.stdout) {
  emit("--- tsc stdout ---");
  emit(result.stdout.trimEnd());
}
if (result.stderr) {
  emit("--- tsc stderr ---");
  emit(result.stderr.trimEnd());
}

if (result.error) {
  emit(`[expo-desktop build] spawn failed: ${result.error}`);
  process.exit(1);
}

const code = result.status ?? 1;
log("tsc finished with exit code:", String(code));

const cliOut = path.join(pkgRoot, "build", "cli.js");
if (code === 0 && !fs.existsSync(cliOut)) {
  emit(`[expo-desktop build] expected output missing after success: ${cliOut}`);
  process.exit(1);
}
if (code === 0) {
  log("ok:", cliOut);
}

process.exit(code);
