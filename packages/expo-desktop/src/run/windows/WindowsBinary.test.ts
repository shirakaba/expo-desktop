import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";

import {
  exportWindowsBuildArtifactsAsync,
  resolveWindowsBuildArtifactsAsync,
  restoreWindowsBuildArtifactsAsync,
} from "./WindowsBinary.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.promises.rm(directory, { recursive: true, force: true })),
  );
});

test("resolves artifacts from a Windows build-output root", async () => {
  const windowsRoot = await createWindowsArtifactsAsync("ARM64", "Release");

  await expect(
    resolveWindowsBuildArtifactsAsync(windowsRoot, "ARM64", "Release"),
  ).resolves.toStrictEqual({
    windowsRoot,
    layoutRoot: path.join(windowsRoot, "ARM64", "Release"),
    appPackagesRoot: path.join(windowsRoot, "MyApp.Package", "AppPackages"),
  });
});

test("does not infer an artifact root from a nested layout path", async () => {
  const windowsRoot = await createWindowsArtifactsAsync("ARM64", "Release");

  await expect(
    resolveWindowsBuildArtifactsAsync(
      path.join(windowsRoot, "ARM64", "Release"),
      "ARM64",
      "Release",
    ),
  ).rejects.toThrow(/Pass the Windows directory/);
});

test("rejects an artifact that does not include AppPackages", async () => {
  const windowsRoot = await createTemporaryDirectoryAsync();
  await fs.promises.mkdir(path.join(windowsRoot, "ARM64", "Debug"), { recursive: true });

  await expect(resolveWindowsBuildArtifactsAsync(windowsRoot, "ARM64", "Debug")).rejects.toThrow(
    /MyApp\.Package.*AppPackages/s,
  );
});

test("restores both artifact trees at the paths expected by RNW", async () => {
  const sourceRoot = await createWindowsArtifactsAsync("ARM64", "Debug");
  const destinationRoot = await createTemporaryDirectoryAsync();
  const source = await resolveWindowsBuildArtifactsAsync(sourceRoot, "ARM64", "Debug");

  await restoreWindowsBuildArtifactsAsync(source, destinationRoot, "ARM64", "Debug");

  await expect(
    fs.promises.readFile(path.join(destinationRoot, "ARM64", "Debug", "layout.txt"), "utf8"),
  ).resolves.toBe("layout");
  await expect(
    fs.promises.readFile(
      path.join(destinationRoot, "MyApp.Package", "AppPackages", "package.txt"),
      "utf8",
    ),
  ).resolves.toBe("package");
});

test("exports an artifact that can be passed back to --binary", async () => {
  const sourceRoot = await createWindowsArtifactsAsync("x86", "Debug");
  const outputRoot = await createTemporaryDirectoryAsync();
  const source = await resolveWindowsBuildArtifactsAsync(sourceRoot, "x86", "Debug");

  await exportWindowsBuildArtifactsAsync(source, outputRoot, "x86", "Debug");

  await expect(
    resolveWindowsBuildArtifactsAsync(outputRoot, "x86", "Debug"),
  ).resolves.toStrictEqual({
    windowsRoot: outputRoot,
    layoutRoot: path.join(outputRoot, "Debug"),
    appPackagesRoot: path.join(outputRoot, "MyApp.Package", "AppPackages"),
  });
});

async function createWindowsArtifactsAsync(
  arch: "x86" | "x64" | "ARM64",
  configuration: "Debug" | "Release",
): Promise<string> {
  const windowsRoot = await createTemporaryDirectoryAsync();
  const layoutRoot = path.join(windowsRoot, arch === "x86" ? configuration : arch, configuration);
  const packageRoot = path.join(windowsRoot, "MyApp.Package", "AppPackages");

  await fs.promises.mkdir(layoutRoot, { recursive: true });
  await fs.promises.mkdir(packageRoot, { recursive: true });
  await fs.promises.writeFile(path.join(layoutRoot, "layout.txt"), "layout");
  await fs.promises.writeFile(path.join(packageRoot, "package.txt"), "package");

  return windowsRoot;
}

async function createTemporaryDirectoryAsync(): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "expo-windows-binary-"));
  temporaryDirectories.push(directory);
  return directory;
}
