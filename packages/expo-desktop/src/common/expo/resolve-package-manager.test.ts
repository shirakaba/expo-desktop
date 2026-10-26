import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as TOML from "smol-toml";
import { afterEach, expect, test, vi } from "vitest";

import { configurePackageManager } from "./resolve-package-manager.ts";

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

async function createProject(workspace: boolean) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "expo-desktop-package-manager-"));
  directories.push(root);
  const projectRoot = workspace ? path.join(root, "apps/HelloWorld") : root;
  await fs.mkdir(projectRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    JSON.stringify({ name: "hello-world" }),
  );
  if (workspace) {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ private: true, workspaces: ["apps/*"] }),
    );
  }
  return { root, projectRoot };
}

test.each([false, true])(
  "configures npm hoisting at the project/workspace root (workspace: %s)",
  async (workspace) => {
    const { root, projectRoot } = await createProject(workspace);
    // Run npm itself to check the persisted setting, including workspace behavior.
    await configurePackageManager(projectRoot, "npm", { silent: true });
    expect(await fs.readFile(path.join(root, ".npmrc"), "utf8")).toContain(
      "install-strategy=hoisted",
    );
    if (workspace) {
      await expect(fs.access(path.join(projectRoot, ".npmrc"))).rejects.toThrow();
    }
  },
  15000,
);

test.each([false, true])(
  "configures Bun hoisting while preserving existing options (workspace: %s)",
  async (workspace) => {
    const { root, projectRoot } = await createProject(workspace);
    await fs.writeFile(
      path.join(root, "bunfig.toml"),
      'telemetry = false\n[install]\nlinker = "isolated"\nexact = true\n[install.cache]\ndisable = true\n',
    );

    await configurePackageManager(projectRoot, "bun", { silent: true });
    await configurePackageManager(projectRoot, "bun", { silent: true });

    expect(TOML.parse(await fs.readFile(path.join(root, "bunfig.toml"), "utf8"))).toEqual({
      telemetry: false,
      install: { linker: "hoisted", exact: true, cache: { disable: true } },
    });
    if (workspace) {
      await expect(fs.access(path.join(projectRoot, "bunfig.toml"))).rejects.toThrow();
    }
  },
);

test("creates Bun configuration when the project has none", async () => {
  const { projectRoot } = await createProject(false);
  await configurePackageManager(projectRoot, "bun", { silent: true });
  expect(TOML.parse(await fs.readFile(path.join(projectRoot, "bunfig.toml"), "utf8"))).toEqual({
    install: { linker: "hoisted" },
  });
});
