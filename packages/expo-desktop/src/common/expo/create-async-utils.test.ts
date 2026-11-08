import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { configureNodeDependenciesAsync, setupDependenciesAsync } from "./create-async-utils.ts";
import { findAncestorWorkspaceAsync } from "./find-ancestor-workspace.ts";
import * as managers from "./resolve-package-manager.ts";
import * as template from "./template.ts";

vi.mock("./template.ts", () => ({ installPodsAsync: vi.fn(), logProjectReady: vi.fn() }));

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "expo-desktop-create-app-"));
  directories.push(root);
  const projectRoot = path.join(root, "apps/HelloWorld");
  await fs.mkdir(path.join(projectRoot, "ios"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "macos"));
  await fs.writeFile(path.join(projectRoot, "package.json"), '{"name":"hello-world"}');
  return { root, projectRoot };
}

test.each([
  { file: "package.json", contents: '{"workspaces":["apps/*"]}' },
  { file: "package.json", contents: '{"workspaces":{"packages":["other/*"]}}' },
  { file: "package.json", contents: '{"workspaces":[]}' },
  { file: "pnpm-workspace.yaml", contents: "packages: [other/*]\n" },
])("skips installs inside a monorepo declared by $contents", async ({ file, contents }) => {
  const { root, projectRoot } = await fixture();
  await fs.writeFile(path.join(root, file), contents);
  // Neither a nested package nor app-local configuration hides enclosing monorepos.
  await fs.writeFile(path.join(root, "apps/package.json"), '{"private":true}');
  await fs.writeFile(path.join(projectRoot, "pnpm-workspace.yaml"), "nodeLinker: hoisted\n");
  vi.spyOn(managers, "resolvePackageManager").mockReturnValue("pnpm");
  const configure = vi.spyOn(managers, "configurePackageManager");
  const install = vi.spyOn(managers, "installDependenciesAsync").mockResolvedValue();
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  expect(await findAncestorWorkspaceAsync(projectRoot)).toEqual({
    type: "resolve",
    workspaceRoot: root,
  });

  await setupDependenciesAsync(projectRoot, { install: true });

  expect(configure).toHaveBeenCalledWith(projectRoot, "pnpm");
  expect(install).not.toHaveBeenCalled();
  expect(template.installPodsAsync).not.toHaveBeenCalled();
  expect(await fs.readFile(path.join(root, file), "utf8")).toBe(contents);
  const output = log.mock.calls.map((args) => args.join(" ")).join("\n");
  const docs = "https://expo-desktop-docs.vercel.app/guides/prebuild/monorepo-support";
  expect(output).toContain(docs);
  expect(output.indexOf(docs)).toBeLessThan(output.indexOf("pnpm install"));
  if (process.platform === "darwin") {
    expect(output.indexOf("pnpm install")).toBeLessThan(output.indexOf("pod install"));
  }
});

test.each([true, false])("respects install=%s outside monorepos", async (installRequested) => {
  const { projectRoot } = await fixture();
  vi.spyOn(managers, "resolvePackageManager").mockReturnValue("pnpm");
  const install = vi.spyOn(managers, "installDependenciesAsync").mockResolvedValue();
  vi.spyOn(console, "log").mockImplementation(() => {});
  expect(await findAncestorWorkspaceAsync(projectRoot)).toEqual({
    type: "resolve",
    workspaceRoot: null,
  });

  await setupDependenciesAsync(projectRoot, { install: installRequested });

  expect(install).toHaveBeenCalledTimes(installRequested ? 1 : 0);
  expect(template.installPodsAsync).toHaveBeenCalledTimes(installRequested ? 2 : 0);
});

test("skips installs when ancestor detection fails, and reports the file", async () => {
  const { root, projectRoot } = await fixture();
  await fs.writeFile(path.join(root, "package.json"), "{");
  vi.spyOn(managers, "resolvePackageManager").mockReturnValue("bun");
  const install = vi.spyOn(managers, "installDependenciesAsync").mockResolvedValue();
  vi.spyOn(console, "log").mockImplementation(() => {});
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  await setupDependenciesAsync(projectRoot, { install: true });

  expect(install).not.toHaveBeenCalled();
  expect(template.installPodsAsync).not.toHaveBeenCalled();
  expect(error.mock.calls.flat().join("\n")).toContain(path.join(root, "package.json"));
});

test("skips installs when patch configuration fails", async () => {
  const { projectRoot } = await fixture();
  vi.spyOn(managers, "resolvePackageManager").mockReturnValue("npm");
  vi.spyOn(managers, "configurePackageManager").mockResolvedValue({
    type: "reject",
    subtype: "unsupported patching version",
    packageManager: "npm",
    minimumVersion: 12,
    updatedFiles: [],
  });
  const install = vi.spyOn(managers, "installDependenciesAsync").mockResolvedValue();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});

  await setupDependenciesAsync(projectRoot, { install: true });

  expect(install).not.toHaveBeenCalled();
  expect(template.installPodsAsync).not.toHaveBeenCalled();
});

test("preserves the full configuration failure for its caller", async () => {
  const { projectRoot } = await fixture();
  const result = {
    type: "reject",
    subtype: "failed to write template manifest",
    filePath: path.join(projectRoot, "package.json"),
    error: new Error("write failed"),
    updatedFiles: [path.join(projectRoot, ".yarnrc.yml")],
  } as const;
  vi.spyOn(managers, "configurePackageManager").mockResolvedValue({
    ...result,
    updatedFiles: [...result.updatedFiles],
  });
  vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await configureNodeDependenciesAsync(projectRoot, "yarn")).toEqual(result);
});

test.each(["access", "read", "parse"] as const)(
  "reports ancestor workspace %s failures distinctly",
  async (operation) => {
    const { root, projectRoot } = await fixture();
    const filePath = path.join(
      root,
      "apps",
      operation === "access" ? "pnpm-workspace.yaml" : "package.json",
    );
    const error = new Error("ancestor inaccessible");
    if (operation === "access") vi.spyOn(fs, "access").mockRejectedValueOnce(error);
    else if (operation === "read") vi.spyOn(fs, "readFile").mockRejectedValueOnce(error);
    else await fs.writeFile(filePath, "{");

    await expect(findAncestorWorkspaceAsync(projectRoot)).resolves.toMatchObject({
      type: "reject",
      subtype: {
        access: "failed to access pnpm workspace file",
        read: "failed to read ancestor manifest",
        parse: "failed to parse ancestor manifest",
      }[operation],
      filePath,
      error: operation === "parse" ? expect.any(SyntaxError) : error,
    });
  },
);
