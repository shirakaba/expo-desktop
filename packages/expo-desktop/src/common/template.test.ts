import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

import { applySelectedTemplatesAsync } from "./template.ts";

const execFileAsync = promisify(execFile);
const tempRoots = new Set<string>();

afterEach(async () => {
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
  tempRoots.clear();
});

test("returns the checksum of a local template tarball", async () => {
  const tempRoot = await makeTempRootAsync();
  const fixtureRoot = path.join(tempRoot, "fixture");
  const templateRoot = path.join(fixtureRoot, "template-root");
  await fs.mkdir(templateRoot, { recursive: true });
  await fs.writeFile(path.join(templateRoot, "README.md"), "HelloWorld\n", "utf-8");

  const archivePath = path.join(tempRoot, "template.tgz");
  await execFileAsync(getTarCommand(), ["-czf", archivePath, "-C", fixtureRoot, "template-root"]);

  const projectRoot = path.join(tempRoot, "project");
  await fs.mkdir(projectRoot);

  const checksum = await getFileChecksumAsync(archivePath);
  const appliedTemplates = await applySelectedTemplatesAsync({
    projectRoot,
    selection: { template: archivePath },
    enabledPlatforms: [],
    name: {
      displayName: "My App",
      filesafeName: "MyApp",
      rdns: "com.example.myapp",
    },
    respectTemplateConfig: false,
  });

  expect(appliedTemplates).toEqual([{ key: "template", checksum }]);
  await expect(fs.readFile(path.join(projectRoot, "README.md"), "utf-8")).resolves.toBe(
    "HelloWorld\n",
  );
});

async function makeTempRootAsync(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "expo-desktop-template-test-"));
  tempRoots.add(tempRoot);
  return tempRoot;
}

function getTarCommand(): string {
  return process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
}

function getFileChecksumAsync(file: string): Promise<string> {
  const hash = crypto.createHash("md5");
  const stream = createReadStream(file);
  const { promise, resolve, reject } = Promise.withResolvers<string>();

  stream.on("data", (chunk) => {
    hash.update(chunk);
  });
  stream.on("error", reject);
  stream.on("end", () => {
    resolve(hash.digest("hex"));
  });

  return promise;
}
