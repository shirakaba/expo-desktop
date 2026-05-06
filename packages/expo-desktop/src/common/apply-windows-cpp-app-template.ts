import { glob } from "glob";
import mustache from "mustache";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import packageJson from "../../package.json" with { type: "json" };

/**
 * Mirrors the effective behaviour of `vnext/templates/cpp-app/template.config.js`
 * from react-native-windows (path renames + Mustache replacements) without
 * executing that file (it pulls undeclared deps and `../templateUtils`).
 *
 * @see https://github.com/microsoft/react-native-windows/blob/main/vnext/templates/cpp-app/template.config.js
 * @see https://github.com/microsoft/react-native-windows/blob/main/packages/%40react-native-windows/cli/src/generator-common/index.ts
 */
export async function applyWindowsCppAppTemplateAsync(
  projectRoot: string,
  name: { filesafeName: string; rdns: string },
): Promise<void> {
  const windowsRoot = path.join(projectRoot, "windows");
  try {
    await fs.access(windowsRoot);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    return;
  }

  if (!(await looksLikeCppAppTemplateAsync(windowsRoot))) {
    return;
  }

  const replacements = await buildReplacementsRecord(projectRoot, name);

  await renameCppAppPathsAsync(windowsRoot, name.filesafeName);
  await renderMustacheUnderWindowsAsync(windowsRoot, replacements);
  await finalizeWindowsCppTemplateArtifacts(projectRoot, windowsRoot);
}

async function looksLikeCppAppTemplateAsync(windowsRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(windowsRoot, "MyApp"));
    return true;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    const entries = await fs.readdir(windowsRoot).catch(() => []);
    return entries.some((e) => e.includes("MyApp"));
  }
}

/** Same as legacy `react-native init-windows --namespace` (strip `-` and `_` only). */
function windowsNamespaceFromRdns(rdns: string): string {
  return rdns.replaceAll(/[-_]/g, "");
}

async function tryReadRnwFromNodeModules(projectRoot: string): Promise<{
  path: string;
  version: string;
  devMode: boolean;
} | null> {
  const pkgPath = path.join(projectRoot, "node_modules", "react-native-windows", "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const version = (JSON.parse(raw) as { version?: string }).version;
    if (!version) {
      return null;
    }
    const rnwPath = path.dirname(pkgPath);
    let devMode = false;
    try {
      await fs.access(path.join(rnwPath, "src-win"));
      devMode = true;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      devMode = false;
    }
    return { path: rnwPath, version, devMode };
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }

    return null;
  }
}

async function reactNativeWindowsVersionFromPackageJson(
  projectRoot: string,
): Promise<string | null> {
  const pkgPath = path.join(projectRoot, "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const parsed = JSON.parse(raw) as { dependencies?: Record<string, string> };
    const v = parsed.dependencies?.["react-native-windows"];
    return typeof v === "string" ? v : null;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    return null;
  }
}

async function buildReplacementsRecord(
  projectRoot: string,
  name: { filesafeName: string; rdns: string },
): Promise<Record<string, unknown>> {
  const projectGuid = crypto.randomUUID();
  const packageGuid = crypto.randomUUID();
  const namespace = windowsNamespaceFromRdns(name.rdns);
  const namespaceCpp = namespace.replaceAll(".", "::");
  const mainComponentName = name.filesafeName;

  const rnw = await tryReadRnwFromNodeModules(projectRoot);
  const rnwVersion =
    rnw?.version ?? (await reactNativeWindowsVersionFromPackageJson(projectRoot)) ?? "0.0.0";
  const rnwPathFromProjectRoot = rnw
    ? path.relative(projectRoot, rnw.path).replaceAll("/", "\\")
    : "node_modules\\react-native-windows";
  const devMode = rnw?.devMode ?? false;
  const isCanary = rnwVersion.includes("canary");

  return {
    name: name.filesafeName,
    namespace,
    namespaceCpp,
    rnwVersion,
    rnwPathFromProjectRoot,
    mainComponentName,
    projectGuidLower: `{${projectGuid.toLowerCase()}}`,
    projectGuidUpper: `{${projectGuid.toUpperCase()}}`,
    packageGuidLower: `{${packageGuid.toLowerCase()}}`,
    packageGuidUpper: `{${packageGuid.toUpperCase()}}`,
    currentUser: os.userInfo().username,
    devMode,
    useNuGets: !devMode,
    addReactNativePublicAdoFeed: true || isCanary,
    cppNugetPackages: [] as unknown[],
    autolinkPropertiesForProps: "",
    autolinkProjectReferencesForTargets: "",
    autolinkCppIncludes: "",
    autolinkCppPackageProviders: "\n UNREFERENCED_PARAMETER(packageProviders);",
  };
}

function cppAppRelativePathTransform(relativeToWindows: string, filesafeName: string): string {
  const parts = relativeToWindows.split(/[/\\]/);
  const base = parts.at(-1) ?? "";
  if (base === "_gitignore") {
    parts[parts.length - 1] = ".gitignore";
  } else if (base === "NuGet_Config") {
    parts[parts.length - 1] = "NuGet.config";
  }
  return parts.join(path.sep).split("MyApp").join(filesafeName);
}

function pathDepth(p: string): number {
  return p.split(path.sep).filter(Boolean).length;
}

async function collectWindowsPathsAsync(windowsRoot: string): Promise<Array<string>> {
  const out: Array<string> = [];
  async function walk(current: string) {
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      return;
    }
    if (stat.isSymbolicLink()) {
      return;
    }
    if (stat.isDirectory()) {
      out.push(current);
      for (const ent of await fs.readdir(current, { withFileTypes: true })) {
        await walk(path.join(current, ent.name));
      }
      return;
    }
    if (stat.isFile()) {
      out.push(current);
    }
  }
  await walk(windowsRoot);
  return out;
}

/**
 * Renames cpp-app paths containing `MyApp` → filesafeName. Uses iterative
 * shallow-first ordering (directories before files at the same depth). Deeper
 * fixes caused ENOTEMPTY: files were renamed into `*.Package/Images` before the
 * directory `MyApp.Package/Images` moved, leaving a non-empty destination.
 */
async function renameCppAppPathsAsync(windowsRoot: string, filesafeName: string): Promise<void> {
  for (;;) {
    const allPaths = await collectWindowsPathsAsync(windowsRoot);
    const candidates: Array<{ abs: string; rel: string; depth: number; isDir: boolean }> = [];

    for (const abs of allPaths) {
      const rel = path.relative(windowsRoot, abs);
      if (!rel || rel.includes("..")) {
        continue;
      }
      if (!rel.includes("MyApp")) {
        continue;
      }

      let stat;
      try {
        stat = await fs.lstat(abs);
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
        continue;
      }

      if (stat.isSymbolicLink()) {
        continue;
      }

      candidates.push({
        abs,
        rel,
        depth: pathDepth(rel),
        isDir: stat.isDirectory(),
      });
    }

    if (!candidates.length) {
      break;
    }

    candidates.sort((a, b) => {
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }
      if (a.isDir !== b.isDir) {
        return a.isDir ? -1 : 1;
      }
      return a.rel.localeCompare(b.rel);
    });

    const chosen = candidates[0];
    const newRelWin = cppAppRelativePathTransform(chosen.rel, filesafeName);
    if (newRelWin === chosen.rel) {
      throw new Error(
        `Windows cpp-app rename: expected path containing MyApp to change: "${chosen.rel}"`,
      );
    }

    const newAbs = path.join(windowsRoot, newRelWin);
    if (newAbs === chosen.abs) {
      continue;
    }

    await fs.mkdir(path.dirname(newAbs), { recursive: true });

    try {
      await fs.rename(chosen.abs, newAbs);
    } catch (cause) {
      throw new Error(`Failed to rename "${chosen.abs}" -> "${newAbs}"`, { cause });
    }
  }
}

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".jar",
  ".keystore",
  ".ico",
  ".pdb",
  ".dll",
  ".exe",
  ".bin",
]);

function isProbablyBinaryFile(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function adjustReplacementStringsForLineEndings(
  view: Record<string, unknown>,
  useCRLF: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...view };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string") {
      out[key] = useCRLF ? value.replaceAll(/(?<!\r)\n/g, "\r\n") : value.replaceAll(/\r\n/g, "\n");
    }
  }
  return out;
}

async function collectWindowsFilesAsync(windowsRoot: string): Promise<Array<string>> {
  const all = await collectWindowsPathsAsync(windowsRoot);
  const files = new Array<string>();
  for (const p of all) {
    try {
      if ((await fs.lstat(p)).isFile()) {
        files.push(p);
      }
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
      // skip
    }
  }
  return files;
}

async function renderMustacheUnderWindowsAsync(
  windowsRoot: string,
  view: Record<string, unknown>,
): Promise<void> {
  const filePaths = await collectWindowsFilesAsync(windowsRoot);

  await Promise.all(
    filePaths.map(async (absoluteFilePath) => {
      if (isProbablyBinaryFile(absoluteFilePath)) {
        return;
      }
      let content: string;
      try {
        content = await fs.readFile(absoluteFilePath, "utf8");
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
        return;
      }
      if (!content.includes("{{")) {
        return;
      }

      const useCRLF = content.includes("\r\n");
      const adjustedView = adjustReplacementStringsForLineEndings(view, useCRLF);
      const rendered = mustache.render(content, adjustedView);
      if (rendered !== content) {
        await fs.writeFile(absoluteFilePath, rendered, "utf8");
      }
    }),
  );
}

async function finalizeWindowsCppTemplateArtifacts(
  projectRoot: string,
  windowsRoot: string,
): Promise<void> {
  const gitignoreRelPaths = await glob("**/_gitignore", {
    cwd: windowsRoot,
    nodir: true,
    dot: true,
  });

  for (const rel of gitignoreRelPaths.sort().reverse()) {
    const fromAbs = path.join(windowsRoot, rel);
    const toAbs = path.join(windowsRoot, path.dirname(rel), ".gitignore");
    await renameIfExistsPreferDest(fromAbs, toAbs);
  }

  await renameIfExistsPreferDest(
    path.join(projectRoot, "NuGet_Config"),
    path.join(projectRoot, "NuGet.config"),
  );

  const version = packageJson.version;
  const banner = `<!-- This project was created with expo-desktop ${version} -->`;
  const reactNativeWindowsBanner =
    /<!--\s*This project was created with react-native-windows[^\n\r]*-->/g;

  const vcxprojRelPaths = await glob("windows/**/*.vcxproj", {
    cwd: projectRoot,
    nodir: true,
    dot: true,
  });

  await Promise.all(
    vcxprojRelPaths.map(async (relPath) => {
      const absolutePath = path.join(projectRoot, relPath);
      let contents: string;
      try {
        contents = await fs.readFile(absolutePath, "utf8");
      } catch {
        return;
      }
      const replaced = contents.replace(reactNativeWindowsBanner, banner);
      if (replaced !== contents) {
        await fs.writeFile(absolutePath, replaced, "utf8");
      }
    }),
  );
}

async function renameIfExistsPreferDest(from: string, to: string): Promise<void> {
  try {
    await fs.access(from);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
    return;
  }
  try {
    await fs.rename(from, to);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      await fs.unlink(from);
      return;
    }
    throw error;
  }
}
