import { tasks } from "@clack/prompts";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { Readable, Transform, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";

import { applyWindowsCppAppTemplateAsync } from "./apply-windows-cpp-app-template.ts";
import { promisifiedSpawnTask } from "./child-process.ts";
import {
  getTemplateFilesToRenameAsync,
  renameTemplateAppNameAsync,
} from "./rename-template-app-name.ts";
import { getShescape } from "./shescape.ts";

export async function applySelectedTemplatesAsync({
  projectRoot,
  template = "blank-typescript",
  enabledPlatforms,
  name,
}: {
  projectRoot: string;
  template?: string | undefined;
  enabledPlatforms: readonly TemplatePlatform[];
  name: { displayName: string; filesafeName: string; rdns: string };
}): Promise<AppliedTemplateResult[]> {
  // Post-process the templates just like the `react-native-macos-init` and
  // `react-native init-windows` commands do:
  //
  // macos:
  // - https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native-macos-init/src/cli.ts#L398
  // - https://github.com/microsoft/react-native-macos/blob/eb3bccb6e738650d617945770ec1319d5880084b/packages/react-native/local-cli/generate-macos.js#L18
  // - https://github.com/microsoft/react-native-macos/tree/main/packages/react-native/local-cli/generator-macos/templates/macos
  //
  // windows:
  // - https://github.com/microsoft/react-native-windows/blob/3d64f71ed8495da6a0dcfc1f97bcb8f761986594/packages/%40react-native-windows/cli/src/generator-windows/index.ts#L57
  // - https://github.com/microsoft/react-native-windows/tree/main/vnext/templates/cpp-app
  const source = parseTemplateSource(template);
  const extracted = await prepareTemplateSourceAsync("Extracting template", source);
  try {
    const templateRoot = await resolveTemplateRootAsync(extracted.root, source);
    await copyTemplateFilesAsync({
      sourceRoot: templateRoot,
      projectRoot,
      name,
      enabledPlatforms,
    });
    return [{ key: "template", checksum: extracted.checksum }];
  } finally {
    await fs.rm(extracted.root, { recursive: true, force: true });
  }
}

type TemplateDescriptor = {
  key: "template" | "template-ios" | "template-android" | "template-macos" | "template-windows";
  value: string;
};

export type TemplatePlatform = "ios" | "android" | "macos" | "windows";

export type AppliedTemplateResult = {
  key: TemplateDescriptor["key"];
  checksum: string;
};

function parseTemplateSource(template: string): TemplateSource {
  const localPath = path.resolve(process.cwd(), template);
  if (/\.(?:tar|tgz|tar\.gz)$/i.test(template)) {
    return { type: "local-tarball", path: localPath };
  }

  const githubUrlMatch = template.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/#]+?)(?:\/(?:tree|blob)\/([^/]+)(?:\/(.+))?)?$/,
  );
  if (githubUrlMatch) {
    const [, owner, repo, ref = "HEAD", subpath] = githubUrlMatch;
    return { type: "github", owner, repo, ref, subpath: subpath ?? null };
  }

  const githubShorthandMatch = template.match(/^([^/\s#]+)\/([^/\s#]+)(?:#(.+))?$/);
  if (githubShorthandMatch) {
    const [, owner, repo, rawRef] = githubShorthandMatch;
    const [ref, ...subpathParts] = (rawRef ?? "HEAD").split(":");
    return {
      type: "github",
      owner,
      repo,
      ref,
      subpath: subpathParts.length ? subpathParts.join(":") : null,
    };
  }

  return { type: "npm", spec: template };
}

type TemplateSource =
  | { type: "local-tarball"; path: string }
  | { type: "github"; owner: string; repo: string; ref: string; subpath: string | null }
  | { type: "npm"; spec: string };

async function prepareTemplateSourceAsync(
  taskTitle: string,
  source: TemplateSource,
): Promise<{ root: string; checksum: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "expo-desktop-template-"));
  const archivePath = path.join(tempRoot, "template.tgz");

  try {
    let checksum: string;
    switch (source.type) {
      case "local-tarball":
        checksum = await extractTemplateTarballAsync(createReadStream(source.path), tempRoot, {
          taskTitle,
        });
        break;
      case "github": {
        // Don't think it's possible to have spaces in the owner/repo/ref, so no
        // percent-encoding or quoting needed.
        const tarballUrl = `https://codeload.github.com/${source.owner}/${source.repo}/tar.gz/${source.ref}`;
        const response = await fetch(tarballUrl);
        if (!response.ok || !response.body) {
          throw new Error(`Failed to download template tarball from ${tarballUrl}`);
        }
        checksum = await extractTemplateTarballAsync(response.body, tempRoot, {
          taskTitle,
        });
        break;
      }
      case "npm": {
        const shescape = getShescape();
        await tasks([
          promisifiedSpawnTask({
            title: `npm pack (${source.spec})`,
            command: "npm",
            args: ["pack", shescape.quote(source.spec), "--silent"],
            options: {
              cwd: tempRoot,
              env: getNpmPackEnv(),
            },
          }),
        ]);
        const entries = await fs.readdir(tempRoot);
        const packed = entries.find((entry) => entry.endsWith(".tgz"));
        if (!packed) {
          throw new Error(`Could not pack template "${source.spec}".`);
        }
        await fs.rename(path.join(tempRoot, packed), archivePath);
        checksum = await extractTemplateTarballAsync(createReadStream(archivePath), tempRoot, {
          taskTitle,
        });
        break;
      }
    }

    return { root: tempRoot, checksum };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function getNpmPackEnv(): NodeJS.ProcessEnv {
  const nodeBin = path.dirname(process.execPath);
  const pathEntries = process.env.PATH?.split(path.delimiter) ?? [];
  if (pathEntries[0] === nodeBin) {
    return process.env;
  }

  return {
    ...process.env,
    PATH: [nodeBin, ...pathEntries.filter((entry) => entry !== nodeBin)].join(path.delimiter),
  };
}

// Match Expo CLI by hashing the compressed tarball bytes before decompression.
class ChecksumStream extends Transform {
  hash: crypto.Hash;

  constructor(algorithm: string) {
    super();
    this.hash = crypto.createHash(algorithm);
  }

  digest(): Buffer;
  digest(encoding: crypto.BinaryToTextEncoding): string;
  digest(encoding?: crypto.BinaryToTextEncoding): string | Buffer {
    return encoding ? this.hash.digest(encoding) : this.hash.digest();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    this.hash.update(chunk);
    callback(null, chunk);
  }
}

type TarballReadable = Readable | Parameters<typeof Readable.fromWeb>[0];

async function extractTemplateTarballAsync(
  input: TarballReadable,
  output: string,
  {
    taskTitle,
    checksumAlgorithm = "md5",
  }: {
    taskTitle: string;
    checksumAlgorithm?: string;
  },
): Promise<string> {
  let checksum: string | undefined;

  await tasks([
    {
      title: taskTitle,
      task: async (message) => {
        checksum = await extractTarballStreamAsync(input, output, {
          checksumAlgorithm,
          logLine: message,
        });
      },
    },
  ]);

  if (checksum === undefined) {
    throw new Error("Failed to calculate template checksum.");
  }

  return checksum;
}

async function extractTarballStreamAsync(
  input: TarballReadable,
  output: string,
  {
    checksumAlgorithm,
    logLine,
  }: {
    checksumAlgorithm: string;
    logLine: (line: string) => void;
  },
): Promise<string> {
  await fs.mkdir(output, { recursive: true });

  const checksumStream = new ChecksumStream(checksumAlgorithm);
  const tar = spawn(getTarCommand(), ["-xzf", "-", "-C", output], {
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  const lineBuffer = new Array<string>();
  const pushLine = (stream: "stdout" | "stderr", line: string) => {
    lineBuffer.push(`${stream}\t${line}`);
    logLine(line);
  };

  readline.createInterface({ input: tar.stdout }).on("line", (line) => pushLine("stdout", line));
  readline.createInterface({ input: tar.stderr }).on("line", (line) => pushLine("stderr", line));

  const nodeInput = input instanceof Readable ? input : Readable.fromWeb(input);
  const closePromise = waitForTarClose(tar, lineBuffer);
  const pipePromise = pipeline(nodeInput, checksumStream, tar.stdin);

  const [pipeResult, closeResult] = await Promise.allSettled([pipePromise, closePromise]);
  if (closeResult.status === "rejected") {
    throw closeResult.reason;
  }
  if (pipeResult.status === "rejected") {
    throw new Error("Failed to stream template tarball to tar.", { cause: pipeResult.reason });
  }

  return checksumStream.digest("hex");
}

function getTarCommand(): string {
  // The paths are Windows-style paths rather than POSIX, so make sure to select
  // Windows tar rather than GNU tar, which may be on path due to Git Bash.
  return process.platform === "win32" ? "C:\\Windows\\System32\\tar.exe" : "tar";
}

function waitForTarClose(
  tar: ChildProcessWithoutNullStreams,
  lineBuffer: readonly string[],
): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();

  tar.once("error", (error) => {
    tar.stdin.destroy(error);
    reject(error);
  });

  tar.once("close", (code, signal) => {
    if (code === 0) {
      resolve();
      return;
    }

    const detail =
      lineBuffer.length > 0
        ? `\n\n${lineBuffer.slice(-20).join("\n")}`
        : "\n\n(no stdout/stderr lines were captured)";
    reject(new Error(`tar exited with code ${code} (signal: ${signal}).${detail}`));
  });

  return promise;
}

async function resolveTemplateRootAsync(
  extractedRoot: string,
  source: TemplateSource,
): Promise<string> {
  const entries = await fs.readdir(extractedRoot, { withFileTypes: true });
  const firstDir = entries.find((entry) => entry.isDirectory() && entry.name !== ".git");
  if (!firstDir) {
    throw new Error("Extracted template archive did not contain a root directory.");
  }

  let templateRoot = path.join(extractedRoot, firstDir.name);
  if (source.type === "github" && source.subpath) {
    templateRoot = path.join(templateRoot, source.subpath);
  }

  return templateRoot;
}

type TemplateConfig = {
  files?: Array<{ from: string; to?: string }>;
  replacements?: Record<string, string>;
  pathReplacements?: Record<string, string>;
  renameConfig?: string[];
};

async function copyTemplateFilesAsync({
  sourceRoot,
  projectRoot,
  name,
  enabledPlatforms,
}: {
  sourceRoot: string;
  projectRoot: string;
  name: { displayName: string; filesafeName: string; rdns: string };
  enabledPlatforms: readonly TemplatePlatform[];
}): Promise<void> {
  const mappings = await discoverAllFilesAsync(sourceRoot);

  const pathReplacements = {
    HelloWorld: name.filesafeName,
    helloworld: name.filesafeName.toLowerCase(),
  };

  const copiedRelativePaths = new Array<string>();
  for (const mapping of mappings) {
    const relativePath = replaceTokens(mapping.to, pathReplacements);
    const targetPath = path.join(projectRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(mapping.from, targetPath);
    copiedRelativePaths.push(relativePath);
  }

  const filesFromRenameConfig = await getTemplateFilesToRenameAsync(projectRoot, {});
  const copiedSet = new Set(copiedRelativePaths.map(normalizeToPosixPath));
  const filesToRename = filesFromRenameConfig.filter((file) =>
    copiedSet.has(normalizeToPosixPath(file)),
  );
  await renameTemplateAppNameAsync(projectRoot, {
    filesafeName: name.filesafeName,
    files: filesToRename,
  });

  // Changes to "macos" folder
  await renameMacosUnderscoreGitignore(projectRoot);

  // Changes to "windows" folder
  await applyWindowsCppAppTemplateAsync(projectRoot, name);
}

async function discoverAllFilesAsync(
  sourceRoot: string,
): Promise<Array<{ from: string; to: string }>> {
  const out = new Array<{ from: string; to: string }>();
  await walkFilesAsync(sourceRoot, sourceRoot, out);
  return out.filter((entry) => path.basename(entry.to) !== "template.config.js");
}

async function walkFilesAsync(
  currentDir: string,
  sourceRoot: string,
  output: Array<{ from: string; to: string }>,
) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkFilesAsync(absolute, sourceRoot, output);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    output.push({ from: absolute, to: path.relative(sourceRoot, absolute) });
  }
}

function replaceTokens(input: string, replacements: Record<string, string>): string {
  let output = input;
  for (const [from, to] of Object.entries(replacements)) {
    output = output.split(from).join(to);
  }
  return output;
}

function normalizeToPosixPath(input: string): string {
  return input.replaceAll(path.sep, "/");
}

async function renameMacosUnderscoreGitignore(projectRoot: string): Promise<void> {
  const from = path.join(projectRoot, "macos", "_gitignore");
  const to = path.join(projectRoot, "macos", ".gitignore");
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
