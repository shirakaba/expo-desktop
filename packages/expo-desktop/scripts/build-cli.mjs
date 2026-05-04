#!/usr/bin/env node

/**
 * Writes every line to:
 * - stderr (unbuffered) so local terminals and some CI runners show it
 * - packages/expo-desktop/expo-desktop-build.log so CI can `cat` it after a failed
 *   `npm publish --json` (Changesets uses --json; npm often hides lifecycle stdout).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
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

let nativeRoot;
try {
  nativeRoot = path.dirname(require.resolve("@typescript/native-preview/package.json"));
} catch (cause) {
  emit("[expo-desktop build] could not resolve @typescript/native-preview (is it installed?)");
  emit(String(cause));
  process.exit(1);
}

const nativePkgPath = path.join(nativeRoot, "package.json");
let tsgoVersion = "(unknown)";
try {
  tsgoVersion = JSON.parse(fs.readFileSync(nativePkgPath, "utf8")).version;
} catch {
  // ignore
}
log("@typescript/native-preview version:", tsgoVersion);

const tsgoJs = path.join(nativeRoot, "bin", "tsgo.js");
if (!fs.existsSync(tsgoJs)) {
  emit(`[expo-desktop build] missing tsgo entry: ${tsgoJs}`);
  process.exit(1);
}
log("tsgo entry:", tsgoJs);

const tsgoArgs = ["-p", configPath, "--pretty", "--listEmittedFiles", "--diagnostics"];
if (process.env.EXPO_DESKTOP_BUILD_EXPLAIN === "1") {
  log("EXPO_DESKTOP_BUILD_EXPLAIN=1 → adding --explainFiles");
  tsgoArgs.push("--explainFiles");
}

log("spawning:", [process.execPath, tsgoJs, ...tsgoArgs].join(" "));
const result = spawnSync(process.execPath, [tsgoJs, ...tsgoArgs], {
  cwd: pkgRoot,
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
  env: { ...process.env, FORCE_COLOR: process.stdout.isTTY ? "1" : process.env.FORCE_COLOR },
});

if (result.stdout) {
  emit("--- tsgo stdout ---");
  emit(result.stdout.trimEnd());
}
if (result.stderr) {
  emit("--- tsgo stderr ---");
  emit(result.stderr.trimEnd());
}

if (result.error) {
  emit(`[expo-desktop build] spawn failed: ${result.error}`);
  process.exit(1);
}

const code = result.status ?? 1;
log("tsgo finished with exit code:", String(code));

const cliOut = path.join(pkgRoot, "build", "cli.js");
if (code === 0 && !fs.existsSync(cliOut)) {
  emit(`[expo-desktop build] expected output missing after success: ${cliOut}`);
  process.exit(1);
}
if (code === 0) {
  log("ok:", cliOut);
}

process.exit(code);
