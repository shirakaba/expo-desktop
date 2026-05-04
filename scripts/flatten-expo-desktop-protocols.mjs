#!/usr/bin/env node

/**
 * Flatten or restore npm `workspace:` and `catalog:` specifiers in
 * `expo-desktop-config-plugins` and `expo-desktop-prebuild-config` only.
 *
 * Usage (from repo root):
 *   node scripts/flatten-expo-desktop-protocols.mjs flatten
 *   node scripts/flatten-expo-desktop-protocols.mjs restore
 *
 * State is stored in `.flatten-expo-desktop-protocol-backup.json` at the
 * repo root (gitignored). Run `restore` before `flatten` again.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const __dirname = import.meta.dirname;
const REPO_ROOT = path.resolve(__dirname, "..");
const BACKUP_PATH = path.join(REPO_ROOT, ".flatten-expo-desktop-protocol-backup.json");

const TARGET_RELS = [
  "packages/expo-desktop-config-plugins/package.json",
  "packages/expo-desktop-prebuild-config/package.json",
];

const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

function usage() {
  process.stderr.write(
    `Usage:\n  node scripts/flatten-expo-desktop-protocols.mjs flatten\n  node scripts/flatten-expo-desktop-protocols.mjs restore\n`,
  );
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

async function loadWorkspaceVersions(rootDir) {
  const rootPkg = await readJson(path.join(rootDir, "package.json"));
  const workspaces = rootPkg.workspaces;
  if (!Array.isArray(workspaces)) {
    throw new Error("Root package.json has no workspaces array.");
  }
  /** @type {Map<string, string>} */
  const byName = new Map();
  for (const ws of workspaces) {
    const pkgPath = path.join(rootDir, ws, "package.json");
    if (!(await pathExists(pkgPath))) {
      continue;
    }
    try {
      const pkg = await readJson(pkgPath);
      if (typeof pkg.name === "string" && typeof pkg.version === "string") {
        byName.set(pkg.name, pkg.version);
      }
    } catch {
      // skip invalid workspace entries
    }
  }
  return { catalogs: rootPkg.catalogs ?? {}, versionsByName: byName };
}

/**
 * @param {Record<string, string> | undefined} section
 * @param {Record<string, Record<string, string>>} catalogs
 * @param {Map<string, string>} versionsByName
 */
function flattenDepSections(section, catalogs, versionsByName) {
  if (!section) {
    return;
  }
  for (const [depName, spec] of Object.entries(section)) {
    if (typeof spec !== "string") {
      continue;
    }
    if (spec.startsWith("catalog:")) {
      const catalogKey = spec.slice("catalog:".length);
      const table = catalogs[catalogKey];
      const resolved = table?.[depName];
      if (resolved === undefined) {
        throw new Error(
          `Cannot resolve catalog entry for "${depName}" (${spec}): missing catalogs.${catalogKey}.${depName}`,
        );
      }
      section[depName] = resolved;
      continue;
    }
    if (spec.startsWith("workspace:")) {
      const rest = spec.slice("workspace:".length);
      const v = versionsByName.get(depName);
      if (v === undefined) {
        throw new Error(
          `Cannot resolve workspace entry for "${depName}" (${spec}): no workspace package with that name.`,
        );
      }
      if (rest === "" || rest === "*" || rest === "^" || rest === "~") {
        section[depName] = `^${v}`;
      } else {
        section[depName] = rest;
      }
    }
  }
}

/**
 * @param {Record<string, unknown>} pkg
 * @param {Record<string, Record<string, string>>} catalogs
 * @param {Map<string, string>} versionsByName
 */
function flattenPackageJson(pkg, catalogs, versionsByName) {
  for (const key of DEP_KEYS) {
    const section = pkg[key];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      flattenDepSections(/** @type {Record<string, string>} */ (section), catalogs, versionsByName);
    }
  }
}

async function cmdFlatten() {
  if (await pathExists(BACKUP_PATH)) {
    throw new Error(
      `Backup already exists at ${BACKUP_PATH}. Run "restore" first, or remove that file if you are sure.`,
    );
  }
  /** @type {Record<string, string>} */
  const backup = {};
  for (const rel of TARGET_RELS) {
    const abs = path.join(REPO_ROOT, rel);
    backup[rel] = await fs.readFile(abs, "utf8");
  }
  const { catalogs, versionsByName } = await loadWorkspaceVersions(REPO_ROOT);

  for (const rel of TARGET_RELS) {
    const abs = path.join(REPO_ROOT, rel);
    const pkg = await readJson(abs);
    flattenPackageJson(pkg, catalogs, versionsByName);
    await fs.writeFile(abs, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  await fs.writeFile(BACKUP_PATH, `${JSON.stringify(backup, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Flattened protocols in:\n  ${TARGET_RELS.join("\n  ")}\nBackup: ${BACKUP_PATH}\n`,
  );
}

async function cmdRestore() {
  if (!(await pathExists(BACKUP_PATH))) {
    throw new Error(`No backup at ${BACKUP_PATH}. Nothing to restore.`);
  }
  const backup = await readJson(BACKUP_PATH);
  if (typeof backup !== "object" || backup === null) {
    throw new Error("Backup file is invalid.");
  }
  for (const rel of TARGET_RELS) {
    const content = backup[rel];
    if (typeof content !== "string") {
      throw new Error(`Backup missing entry for ${rel}`);
    }
    const abs = path.join(REPO_ROOT, rel);
    await fs.writeFile(abs, content, "utf8");
  }
  await fs.unlink(BACKUP_PATH);
  process.stdout.write(`Restored package.json files and removed ${BACKUP_PATH}\n`);
}

const cmd = process.argv[2];
try {
  if (cmd === "flatten") {
    await cmdFlatten();
  } else if (cmd === "restore") {
    await cmdRestore();
  } else {
    usage();
    process.exitCode = 1;
  }
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
}
