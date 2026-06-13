import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { promisify } from "node:util";
import { afterEach, expect, test, vi } from "vitest";

import { applySelectedTemplatesAsync } from "./template.ts";

const execFileAsync = promisify(execFile);
const tempRoots = new Set<string>();
const originalPath = process.env.PATH;
const originalNpmCache = process.env.NPM_CONFIG_CACHE;

afterEach(async () => {
  vi.restoreAllMocks();
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  if (originalNpmCache === undefined) {
    delete process.env.NPM_CONFIG_CACHE;
  } else {
    process.env.NPM_CONFIG_CACHE = originalNpmCache;
  }
  await Promise.all([...tempRoots].map((root) => fs.rm(root, { recursive: true, force: true })));
  tempRoots.clear();
});

test("returns the checksum of a local template tarball", async () => {
  const tempRoot = await makeTempRootAsync();
  const archivePath = await createTemplateArchiveAsync(tempRoot, "template-root", {
    "README.md": "HelloWorld\n",
  });

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

test("returns the checksum of a GitHub template tarball", async () => {
  const tempRoot = await makeTempRootAsync();
  const archivePath = await createTemplateArchiveAsync(tempRoot, "repo-main", {
    "templates/basic/README.md": "GitHub template\n",
  });

  const body = Readable.toWeb(createReadStream(archivePath)) as ReadableStream<Uint8Array>;
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body));

  const projectRoot = path.join(tempRoot, "project");
  await fs.mkdir(projectRoot);

  const checksum = await getFileChecksumAsync(archivePath);
  const appliedTemplates = await applySelectedTemplatesAsync({
    projectRoot,
    selection: { template: "https://github.com/example/repo/tree/main/templates/basic" },
    enabledPlatforms: [],
    name: {
      displayName: "My App",
      filesafeName: "MyApp",
      rdns: "com.example.myapp",
    },
    respectTemplateConfig: false,
  });

  expect(fetchSpy).toHaveBeenCalledWith("https://codeload.github.com/example/repo/tar.gz/main");
  expect(appliedTemplates).toEqual([{ key: "template", checksum }]);
  await expect(fs.readFile(path.join(projectRoot, "README.md"), "utf-8")).resolves.toBe(
    "GitHub template\n",
  );
});

test("returns the checksum of an npm template tarball", async () => {
  const tempRoot = await makeTempRootAsync();
  process.env.NPM_CONFIG_CACHE = path.join(tempRoot, "npm-cache");

  const packageRoot = path.join(tempRoot, "template-package");
  await fs.mkdir(packageRoot, { recursive: true });
  await fs.writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify(
      {
        name: "template-package",
        version: "1.0.0",
        files: ["README.md"],
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(path.join(packageRoot, "README.md"), "npm template\n", "utf-8");

  const expectedPackRoot = path.join(tempRoot, "expected-pack");
  await fs.mkdir(expectedPackRoot);
  const expectedArchivePath = await npmPackAsync(packageRoot, expectedPackRoot);

  const projectRoot = path.join(tempRoot, "project");
  await fs.mkdir(projectRoot);

  const checksum = await getFileChecksumAsync(expectedArchivePath);
  const appliedTemplates = await applySelectedTemplatesAsync({
    projectRoot,
    selection: { template: packageRoot },
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
    "npm template\n",
  );
});

async function makeTempRootAsync(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "expo-desktop-template-test-"));
  tempRoots.add(tempRoot);
  return tempRoot;
}

async function createTemplateArchiveAsync(
  tempRoot: string,
  rootDirectoryName: string,
  files: Record<string, string>,
): Promise<string> {
  const fixtureRoot = path.join(tempRoot, `fixture-${rootDirectoryName}`);
  const templateRoot = path.join(fixtureRoot, rootDirectoryName);
  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(templateRoot, relativePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents, "utf-8");
  }

  const archivePath = path.join(tempRoot, `${rootDirectoryName}.tgz`);
  await execFileAsync(getTarCommand(), ["-czf", archivePath, "-C", fixtureRoot, rootDirectoryName]);
  return archivePath;
}

async function npmPackAsync(packageRoot: string, outputRoot: string): Promise<string> {
  const nodeBin = path.dirname(process.execPath);
  const pathEntries = process.env.PATH?.split(path.delimiter) ?? [];
  const { stdout } = await execFileAsync("npm", ["pack", packageRoot, "--silent"], {
    cwd: outputRoot,
    env: {
      ...process.env,
      PATH:
        pathEntries[0] === nodeBin
          ? process.env.PATH
          : [nodeBin, ...pathEntries.filter((entry) => entry !== nodeBin)].join(path.delimiter),
    },
  });
  const filename = stdout.trim().split(/\r?\n/).at(-1);
  if (!filename) {
    throw new Error("npm pack did not print a packed tarball filename.");
  }
  return path.join(outputRoot, filename);
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
