import spawnAsync from "@expo/spawn-async";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as TOML from "smol-toml";
import { afterEach, expect, test, vi } from "vitest";
import { Document, parse } from "yaml";

import { configurePackageManager } from "./resolve-package-manager.ts";

vi.mock("smol-toml", async (importOriginal) => {
  const original = await importOriginal<typeof import("smol-toml")>();
  return { ...original, stringify: vi.fn(original.stringify) };
});

vi.mock("@expo/spawn-async", () => ({ default: vi.fn() }));

function mockVersion(version: string) {
  vi.mocked(spawnAsync).mockResolvedValue({ stdout: version } as Awaited<
    ReturnType<typeof spawnAsync>
  >);
}

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(spawnAsync).mockReset();
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
  "configures npm hoisting only in the app (workspace: %s)",
  async (workspace) => {
    const { root, projectRoot } = await createProject(workspace);
    await fs.writeFile(
      path.join(root, ".npmrc"),
      "# keep registry settings\nregistry=https://registry.npmjs.org/\ninstall-strategy=nested\n",
    );
    expect(await configurePackageManager(projectRoot, "npm")).toEqual({
      type: "resolve",
    });
    expect(await fs.readFile(path.join(projectRoot, ".npmrc"), "utf8")).toContain(
      "install-strategy=hoisted",
    );
    if (workspace) {
      expect(await fs.readFile(path.join(root, ".npmrc"), "utf8")).toContain(
        "install-strategy=nested",
      );
    } else {
      expect(await fs.readFile(path.join(projectRoot, ".npmrc"), "utf8")).toContain(
        "registry=https://registry.npmjs.org/",
      );
    }
  },
  15000,
);

test.each([false, true])(
  "configures Bun hoisting only in the app (workspace: %s)",
  async (workspace) => {
    const { root, projectRoot } = await createProject(workspace);
    await fs.writeFile(
      path.join(projectRoot, "bunfig.toml"),
      'telemetry = false\n[install]\nlinker = "isolated"\nexact = true\n[install.cache]\ndisable = true\n',
    );

    await configurePackageManager(projectRoot, "bun");
    await configurePackageManager(projectRoot, "bun");

    expect(TOML.parse(await fs.readFile(path.join(projectRoot, "bunfig.toml"), "utf8"))).toEqual({
      telemetry: false,
      install: { linker: "hoisted", exact: true, cache: { disable: true } },
    });
    if (workspace) {
      await expect(fs.access(path.join(root, "bunfig.toml"))).rejects.toThrow();
    }
  },
);

test("creates Bun configuration when the project has none", async () => {
  const { projectRoot } = await createProject(false);
  await configurePackageManager(projectRoot, "bun");
  expect(TOML.parse(await fs.readFile(path.join(projectRoot, "bunfig.toml"), "utf8"))).toEqual({
    install: { linker: "hoisted" },
  });
});
test.each(["npm", "pnpm", "yarn", "bun"] as const)(
  "registers %s native patches locally, preserving parent files and other settings",
  async (name) => {
    const { root, projectRoot } = await createProject(true);
    const dependency = "@react-native-windows/cli@0.83.2";
    const patchPath = "patches/@react-native-windows/cli@0.83.2.patch";
    await fs.mkdir(path.dirname(path.join(projectRoot, patchPath)), { recursive: true });
    await fs.writeFile(path.join(projectRoot, patchPath), "template patch\n");
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({
        name: "hello-world",
        dependencies: { existing: "1.0.0" },
        patchedDependencies: { [dependency]: patchPath },
        resolutions: { existing: "1.0.0" },
      }),
    );
    const parentFiles = {
      "package.json": await fs.readFile(path.join(root, "package.json"), "utf8"),
      "pnpm-workspace.yaml": "packages: [apps/*]\nnodeLinker: isolated\n",
      "bunfig.toml": '[install]\nlinker = "isolated"\n',
      ".npmrc": "install-strategy=nested\n",
      ".yarnrc.yml": "nodeLinker: pnp\n",
    };
    for (const [file, contents] of Object.entries(parentFiles)) {
      await fs.writeFile(path.join(root, file), contents);
    }
    await fs.writeFile(
      path.join(projectRoot, "pnpm-workspace.yaml"),
      "# preserve comment\npatchedDependencies:\n  existing@1.0.0: patches/existing.patch\n",
    );
    await fs.writeFile(
      path.join(projectRoot, ".yarnrc.yml"),
      "# preserve comment\nenableTelemetry: false\n",
    );
    mockVersion(name === "npm" ? "12.0.0" : "4.0.0");

    expect(await configurePackageManager(projectRoot, name)).toEqual({
      type: "resolve",
    });
    const firstResult = await fs.readFile(path.join(projectRoot, "package.json"), "utf8");
    expect(await configurePackageManager(projectRoot, name)).toEqual({
      type: "resolve",
    });
    expect(await fs.readFile(path.join(projectRoot, "package.json"), "utf8")).toBe(firstResult);
    const manifest = JSON.parse(firstResult);
    expect(manifest.dependencies).toEqual({ existing: "1.0.0" });
    if (name === "pnpm") {
      const yaml = await fs.readFile(path.join(projectRoot, "pnpm-workspace.yaml"), "utf8");
      expect(yaml).toContain("# preserve comment");
      expect(parse(yaml)).toEqual({
        nodeLinker: "hoisted",
        patchedDependencies: {
          "existing@1.0.0": "patches/existing.patch",
          [dependency]: patchPath,
        },
      });
    } else if (name === "yarn") {
      expect(manifest.resolutions).toEqual({
        existing: "1.0.0",
        "@react-native-windows/cli@npm:0.83.2": `patch:@react-native-windows/cli@npm%3A0.83.2#./${patchPath}`,
      });
      expect(parse(await fs.readFile(path.join(projectRoot, ".yarnrc.yml"), "utf8"))).toEqual({
        nodeLinker: "node-modules",
        enableTelemetry: false,
      });
    }
    expect(manifest.patchedDependencies).toEqual({ [dependency]: patchPath });
    for (const [file, contents] of Object.entries(parentFiles)) {
      expect(await fs.readFile(path.join(root, file), "utf8")).toBe(contents);
    }
  },
);

test.each([
  ["npm", "11.0.0", 12],
  ["yarn", "1.22.22", 2],
] as const)(
  "rejects %s versions without native patch support before writing configuration",
  async (name, version, minimumVersion) => {
    const { projectRoot } = await createProject(false);
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ patchedDependencies: { "example@1.0.0": "patches/example.patch" } }),
    );
    mockVersion(version);
    expect(await configurePackageManager(projectRoot, name)).toEqual({
      type: "reject",
      subtype: "unsupported patching version",
      packageManager: name,
      minimumVersion,
      updatedFiles: [],
    });
    expect(await fs.readdir(projectRoot)).toEqual(["package.json"]);
  },
);

test("reports malformed pnpm configuration without overwriting it", async () => {
  const { projectRoot } = await createProject(false);
  await fs.writeFile(path.join(projectRoot, "pnpm-workspace.yaml"), "patchedDependencies: [\n");
  expect(await configurePackageManager(projectRoot, "pnpm")).toMatchObject({
    type: "reject",
    subtype: "failed to parse YAML configuration",
    updatedFiles: [],
  });
  expect(await fs.readFile(path.join(projectRoot, "pnpm-workspace.yaml"), "utf8")).toBe(
    "patchedDependencies: [\n",
  );
});

test("reports saved configuration if writing patch metadata fails", async () => {
  const { projectRoot } = await createProject(false);
  const manifestFile = path.join(projectRoot, "package.json");
  const manifest = JSON.stringify({ patchedDependencies: { "example@1.0.0": "example.patch" } });
  await fs.writeFile(manifestFile, manifest);
  await fs.writeFile(path.join(projectRoot, "example.patch"), "template patch\n");
  mockVersion("4.0.0");
  const writeFile = fs.writeFile;
  const error = new Error("Cannot write manifest");
  vi.spyOn(fs, "writeFile").mockImplementation(async (...args) => {
    if (args[0] === manifestFile) throw error;
    return writeFile(...args);
  });

  expect(await configurePackageManager(projectRoot, "yarn")).toMatchObject({
    type: "reject",
    subtype: "failed to write template manifest",
    filePath: manifestFile,
    error,
    updatedFiles: [path.join(projectRoot, ".yarnrc.yml")],
  });
  expect(await fs.readFile(manifestFile, "utf8")).toBe(manifest);
});

test.each([null, [], false, { "example@1.0.0": 42 }])(
  "rejects invalid patch metadata %j without writing configuration",
  async (patchedDependencies) => {
    const { projectRoot } = await createProject(false);
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      JSON.stringify({ patchedDependencies }),
    );
    expect(await configurePackageManager(projectRoot, "pnpm")).toMatchObject({
      type: "reject",
      subtype: "invalid template manifest",
    });
    expect(await fs.readdir(projectRoot)).toEqual(["package.json"]);
  },
);

async function addTemplatePatch(projectRoot: string, dependency = "example@1.0.0") {
  const filePath = path.join(projectRoot, "package.json");
  await fs.writeFile(
    filePath,
    JSON.stringify({ name: "hello-world", patchedDependencies: { [dependency]: "example.patch" } }),
  );
  await fs.writeFile(path.join(projectRoot, "example.patch"), "template patch\n");
  return filePath;
}

test.each(["read", "parse"] as const)(
  "distinguishes template manifest %s failures",
  async (operation) => {
    const { projectRoot } = await createProject(false);
    const filePath = path.join(projectRoot, "package.json");
    if (operation === "read") await fs.unlink(filePath);
    else await fs.writeFile(filePath, "{");

    await expect(configurePackageManager(projectRoot, "bun")).resolves.toMatchObject({
      type: "reject",
      subtype:
        operation === "read"
          ? "failed to read template manifest"
          : "failed to parse template manifest",
      filePath,
      error: expect.any(Error),
      updatedFiles: [],
    });
    await expect(fs.access(path.join(projectRoot, "bunfig.toml"))).rejects.toThrow();
  },
);

test("reports the dependency and path of an inaccessible patch", async () => {
  const { projectRoot } = await createProject(false);
  await addTemplatePatch(projectRoot);
  const filePath = path.join(projectRoot, "example.patch");
  await fs.unlink(filePath);

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to access template patch",
    dependency: "example@1.0.0",
    filePath,
    error: expect.any(Error),
    updatedFiles: [],
  });
  await expect(fs.access(path.join(projectRoot, "pnpm-workspace.yaml"))).rejects.toThrow();
});

test("distinguishes configuration read failures from parse failures", async () => {
  const { projectRoot } = await createProject(false);
  const filePath = path.join(projectRoot, "bunfig.toml");
  await fs.mkdir(filePath);

  await expect(configurePackageManager(projectRoot, "bun")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to read package manager configuration",
    filePath,
    error: expect.any(Error),
    updatedFiles: [],
  });
});

test("reports Bun parsing failures without overwriting the configuration", async () => {
  const { projectRoot } = await createProject(false);
  const filePath = path.join(projectRoot, "bunfig.toml");
  await fs.writeFile(filePath, "[");

  await expect(configurePackageManager(projectRoot, "bun")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to parse Bun configuration",
    filePath,
    error: expect.any(Error),
    updatedFiles: [],
  });
  expect(await fs.readFile(filePath, "utf8")).toBe("[");
});

test("reports Bun serialization failures before writing files", async () => {
  const { projectRoot } = await createProject(false);
  const error = new Error("TOML serialization failed");
  vi.mocked(TOML.stringify).mockImplementationOnce(() => {
    throw error;
  });

  await expect(configurePackageManager(projectRoot, "bun")).resolves.toEqual({
    type: "reject",
    subtype: "failed to serialize Bun configuration",
    filePath: path.join(projectRoot, "bunfig.toml"),
    error,
    updatedFiles: [],
  });
  await expect(fs.access(path.join(projectRoot, "bunfig.toml"))).rejects.toThrow();
});

test("reports an invalid YAML node-linker target separately from YAML parsing", async () => {
  const { projectRoot } = await createProject(false);
  const filePath = path.join(projectRoot, "pnpm-workspace.yaml");
  await fs.writeFile(filePath, "true\n");

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to set YAML node linker",
    filePath,
    error: expect.any(Error),
    updatedFiles: [],
  });
  expect(await fs.readFile(filePath, "utf8")).toBe("true\n");
});

test("reports the dependency when a pnpm patch registration cannot be updated", async () => {
  const { projectRoot } = await createProject(false);
  const manifestFile = await addTemplatePatch(projectRoot);
  const originalManifest = await fs.readFile(manifestFile, "utf8");
  const filePath = path.join(projectRoot, "pnpm-workspace.yaml");
  await fs.writeFile(filePath, "patchedDependencies: []\n");

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to register pnpm patch",
    filePath,
    dependency: "example@1.0.0",
    error: expect.any(Error),
    updatedFiles: [],
  });
  expect(await fs.readFile(manifestFile, "utf8")).toBe(originalManifest);
  expect(await fs.readFile(filePath, "utf8")).toBe("patchedDependencies: []\n");
});

test("reports YAML serialization failures before consuming patch metadata", async () => {
  const { projectRoot } = await createProject(false);
  const manifestFile = await addTemplatePatch(projectRoot);
  const originalManifest = await fs.readFile(manifestFile, "utf8");
  const error = new Error("YAML serialization failed");
  vi.spyOn(Document.prototype, "toString").mockImplementationOnce(() => {
    throw error;
  });

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toEqual({
    type: "reject",
    subtype: "failed to serialize YAML configuration",
    filePath: path.join(projectRoot, "pnpm-workspace.yaml"),
    error,
    updatedFiles: [],
  });
  expect(await fs.readFile(manifestFile, "utf8")).toBe(originalManifest);
});

test("reports configuration write failures without consuming patch metadata", async () => {
  const { projectRoot } = await createProject(false);
  const manifestFile = await addTemplatePatch(projectRoot);
  const originalManifest = await fs.readFile(manifestFile, "utf8");
  const error = new Error("configuration write failed");
  vi.spyOn(fs, "writeFile").mockRejectedValueOnce(error);

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toEqual({
    type: "reject",
    subtype: "failed to write package manager configuration",
    filePath: path.join(projectRoot, "pnpm-workspace.yaml"),
    error,
    updatedFiles: [],
  });
  expect(await fs.readFile(manifestFile, "utf8")).toBe(originalManifest);
});

test("reports manifest serialization failures before saving configuration", async () => {
  const { projectRoot } = await createProject(false);
  const filePath = await addTemplatePatch(projectRoot);
  const originalManifest = await fs.readFile(filePath, "utf8");
  const error = new Error("manifest serialization failed");
  mockVersion("4.0.0");
  const stringify = JSON.stringify;
  vi.spyOn(JSON, "stringify").mockImplementation((...args) => {
    if (args[0]?.name === "hello-world") throw error;
    return stringify(...args);
  });

  await expect(configurePackageManager(projectRoot, "yarn")).resolves.toEqual({
    type: "reject",
    subtype: "failed to serialize template manifest",
    filePath,
    error,
    updatedFiles: [],
  });
  expect(await fs.readFile(filePath, "utf8")).toBe(originalManifest);
  await expect(fs.access(path.join(projectRoot, ".yarnrc.yml"))).rejects.toThrow();
});

test("reports the version when parsing package-manager version output fails", async () => {
  const { projectRoot } = await createProject(false);
  await addTemplatePatch(projectRoot);
  mockVersion("invalid");

  await expect(configurePackageManager(projectRoot, "npm")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to parse package manager version",
    packageManager: "npm",
    version: "invalid",
    error: expect.any(Error),
    updatedFiles: [],
  });
});

test("queries the Yarn executable directly without requiring yarnpkg", async () => {
  const { projectRoot } = await createProject(false);
  mockVersion("4.0.0\n");

  await expect(configurePackageManager(projectRoot, "yarn")).resolves.toEqual({ type: "resolve" });
  expect(spawnAsync).toHaveBeenCalledExactlyOnceWith("yarn", ["--version"], { cwd: projectRoot });
});

test("reports version command failures without rejecting the promise", async () => {
  const { projectRoot } = await createProject(false);
  const error = new Error("version command failed");
  vi.mocked(spawnAsync).mockRejectedValueOnce(error);

  await expect(configurePackageManager(projectRoot, "yarn")).resolves.toEqual({
    type: "reject",
    subtype: "failed to resolve package manager version",
    packageManager: "yarn",
    error,
    updatedFiles: [],
  });
});

test("reports invalid Yarn patch versions before writing configuration", async () => {
  const { projectRoot } = await createProject(false);
  const dependency = "example@\ud800";
  const filePath = await addTemplatePatch(projectRoot, dependency);
  mockVersion("4.0.0");

  await expect(configurePackageManager(projectRoot, "yarn")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to encode Yarn patch version",
    filePath,
    dependency,
    version: "\ud800",
    error: expect.any(Error),
    updatedFiles: [],
  });
  await expect(fs.access(path.join(projectRoot, ".yarnrc.yml"))).rejects.toThrow();
});

test("pnpm leaves the manifest byte-identical and revalidates patches on subsequent setup", async () => {
  const { projectRoot } = await createProject(false);
  const manifestFile = await addTemplatePatch(projectRoot);
  const originalManifest = await fs.readFile(manifestFile, "utf8");
  const writes = vi.spyOn(fs, "writeFile");

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toEqual({ type: "resolve" });
  expect(await fs.readFile(manifestFile, "utf8")).toBe(originalManifest);
  expect(writes).toHaveBeenCalledExactlyOnceWith(
    path.join(projectRoot, "pnpm-workspace.yaml"),
    expect.any(String),
  );
  await fs.unlink(path.join(projectRoot, "example.patch"));

  await expect(configurePackageManager(projectRoot, "pnpm")).resolves.toMatchObject({
    type: "reject",
    subtype: "failed to access template patch",
    dependency: "example@1.0.0",
    updatedFiles: [],
  });
});

test("Bun setup does not validate unrelated Yarn resolutions", async () => {
  const { projectRoot } = await createProject(false);
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    JSON.stringify({ resolutions: false }),
  );

  await expect(configurePackageManager(projectRoot, "bun")).resolves.toEqual({ type: "resolve" });
});

test("Yarn Classic without patches does not read or rewrite Berry configuration", async () => {
  const { projectRoot } = await createProject(false);
  const filePath = path.join(projectRoot, ".yarnrc.yml");
  await fs.mkdir(filePath);
  mockVersion("1.22.22");

  await expect(configurePackageManager(projectRoot, "yarn")).resolves.toEqual({ type: "resolve" });
  expect((await fs.stat(filePath)).isDirectory()).toBe(true);
});
