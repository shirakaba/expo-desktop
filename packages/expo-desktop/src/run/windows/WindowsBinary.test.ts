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
    temporaryDirectories.splice(0).map((directory) =>
      fs.promises.rm(directory, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

test("resolves an ARM64 Release build from its loose-layout root", async () => {
  const windowsRoot = await createWindowsArtifactsAsync("ARM64", "Release");
  const layoutRoot = path.join(windowsRoot, "ARM64", "Release");

  await expect(
    resolveWindowsBuildArtifactsAsync(layoutRoot, "ARM64", "Release"),
  ).resolves.toStrictEqual({
    windowsRoot,
    layoutRoot,
    appPackagesRoot: path.join(windowsRoot, "MyApp.Package", "AppPackages"),
    packageDirectories: [
      path.join(windowsRoot, "MyApp.Package", "AppPackages", "Example_1.0.0.0_ARM64_Release_Test"),
    ],
  });
});

test("accepts RNW's Release package fallback without the configuration in its name", async () => {
  const windowsRoot = await createWindowsArtifactsAsync(
    "ARM64",
    "Release",
    "Example_1.0.0.0_ARM64_Test",
  );

  await expect(
    resolveWindowsBuildArtifactsAsync(windowsRoot, "ARM64", "Release"),
  ).resolves.toMatchObject({ windowsRoot });
});

test("rejects an artifact that does not include AppPackages", async () => {
  const windowsRoot = await createTemporaryDirectoryAsync();
  const layout = path.join(windowsRoot, "ARM64", "Debug", "Example");
  await fs.promises.mkdir(layout, { recursive: true });
  await fs.promises.writeFile(path.join(layout, "AppxManifest.xml"), "manifest");
  await fs.promises.writeFile(path.join(layout, "Example.build.appxrecipe"), "recipe");

  await expect(resolveWindowsBuildArtifactsAsync(windowsRoot, "ARM64", "Debug")).rejects.toThrow(
    /MyApp\.Package.*AppPackages/s,
  );
});

test("restores both artifact trees at the paths expected by RNW", async () => {
  const sourceRoot = await createWindowsArtifactsAsync("ARM64", "Debug");
  const destinationRoot = await createTemporaryDirectoryAsync();
  const staleLayout = path.join(destinationRoot, "ARM64", "Debug", "Stale");
  const stalePackage = path.join(
    destinationRoot,
    "MyApp.Package",
    "AppPackages",
    "Stale_1.0.0.0_ARM64_Debug_Test",
  );
  const unrelatedPackage = path.join(
    destinationRoot,
    "MyApp.Package",
    "AppPackages",
    "Other_1.0.0.0_x64_Debug_Test",
  );
  await fs.promises.mkdir(staleLayout, { recursive: true });
  await fs.promises.mkdir(stalePackage, { recursive: true });
  await fs.promises.mkdir(unrelatedPackage, { recursive: true });

  const artifacts = await resolveWindowsBuildArtifactsAsync(sourceRoot, "ARM64", "Debug");
  await restoreWindowsBuildArtifactsAsync(artifacts, destinationRoot, "ARM64", "Debug");

  await expect(
    fs.promises.readFile(
      path.join(destinationRoot, "ARM64", "Debug", "Example", "AppxManifest.xml"),
      "utf8",
    ),
  ).resolves.toBe("manifest");
  await expect(
    fs.promises.readFile(
      path.join(
        destinationRoot,
        "MyApp.Package",
        "AppPackages",
        "Example_1.0.0.0_ARM64_Debug_Test",
        "Add-AppDevPackage.ps1",
      ),
      "utf8",
    ),
  ).resolves.toBe("installer");
  await expect(fs.promises.stat(staleLayout)).rejects.toThrow();
  await expect(fs.promises.stat(stalePackage)).rejects.toThrow();
  await expect(fs.promises.stat(unrelatedPackage)).resolves.toMatchObject({});
});

test("exports an artifact that can be passed back to --binary", async () => {
  const sourceRoot = await createWindowsArtifactsAsync("x86", "Debug");
  const outputRoot = await createTemporaryDirectoryAsync();
  const source = await resolveWindowsBuildArtifactsAsync(sourceRoot, "x86", "Debug");

  await exportWindowsBuildArtifactsAsync(source, outputRoot, "x86", "Debug");

  await expect(
    resolveWindowsBuildArtifactsAsync(outputRoot, "x86", "Debug"),
  ).resolves.toMatchObject({
    windowsRoot: outputRoot,
    layoutRoot: path.join(outputRoot, "Debug"),
    appPackagesRoot: path.join(outputRoot, "MyApp.Package", "AppPackages"),
  });
});

async function createWindowsArtifactsAsync(
  arch: "x86" | "x64" | "ARM64",
  configuration: "Debug" | "Release",
  packageName = `Example_1.0.0.0_${arch}_${configuration}_Test`,
): Promise<string> {
  const windowsRoot = await createTemporaryDirectoryAsync();
  const layoutRoot = path.join(
    windowsRoot,
    ...(arch === "x86" ? [configuration] : [arch, configuration]),
    "Example",
  );
  const packageRoot = path.join(windowsRoot, "MyApp.Package", "AppPackages", packageName);

  await fs.promises.mkdir(layoutRoot, { recursive: true });
  await fs.promises.mkdir(packageRoot, { recursive: true });
  await fs.promises.writeFile(path.join(layoutRoot, "AppxManifest.xml"), "manifest");
  await fs.promises.writeFile(path.join(layoutRoot, "Example.build.appxrecipe"), "recipe");
  await fs.promises.writeFile(path.join(packageRoot, "Add-AppDevPackage.ps1"), "installer");

  return windowsRoot;
}

async function createTemporaryDirectoryAsync(): Promise<string> {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), "expo-windows-binary-"));
  temporaryDirectories.push(directory);
  return directory;
}
