const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const xcode = require("xcode");
const { withExpoXcodeBuildPhase } = require("../src/plugins/macos/withExpoXcodeBuildPhase");

const repoRoot = path.resolve(__dirname, "../../..");

function bundlePhase(project, suffix) {
  const objects = project.hash.project.objects;
  const target = Object.values(objects.PBXNativeTarget).find((target) =>
    target.name?.endsWith(`${suffix}"`),
  );
  return target.buildPhases
    .map(({ value }) => objects.PBXShellScriptBuildPhase[value])
    .find((phase) => phase?.name === '"Bundle React Native code and images"');
}

async function applyPlugin() {
  const project = xcode.project(
    path.join(repoRoot, "templates/bare-minimum/macos/HelloWorld.xcodeproj/project.pbxproj"),
  );
  project.parseSync();
  const iosScript = bundlePhase(project, "-iOS").shellScript;
  const config = withExpoXcodeBuildPhase({ name: "HelloWorld", slug: "hello-world" });
  await config.mods.macos.xcodeproj({
    ...config,
    modRequest: { platform: "macos" },
    modResults: project,
  });
  return { project, iosScript };
}

test("updates the macOS bundle phase without changing the template's iOS target", async () => {
  const { project, iosScript } = await applyPlugin();
  assert.equal(bundlePhase(project, "-iOS").shellScript, iosScript);
  const script = bundlePhase(project, "-macOS").shellScript;
  assert.match(script, /react-native-macos\/package\.json/);
  assert.match(script, /macos relative/);
});

test("fresh debug builds do not embed a LAN address", async (t) => {
  const { project } = await applyPlugin();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "expo-desktop-build-phase-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const resources = "Test App.app/Contents/Resources";
  const ipFile = path.join(temp, resources, "ip.txt");
  fs.mkdirSync(path.dirname(ipFile), { recursive: true });
  const script = bundlePhase(project, "-macOS").shellScript.slice(1, -1).replaceAll('\\"', '"');
  execFileSync("/bin/bash", ["-e", "-c", script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_BINARY: process.execPath,
      PODS_ROOT: path.join(temp, "Pods"),
      PROJECT_DIR: path.join(repoRoot, "templates/bare-minimum/macos"),
      CONFIGURATION: "Debug",
      CONFIGURATION_BUILD_DIR: temp,
      UNLOCALIZED_RESOURCES_FOLDER_PATH: resources,
      PLATFORM_NAME: "macosx",
      ENTRY_FILE: "index.js",
      CLI_PATH: "unused-in-debug",
    },
    stdio: "pipe",
  });
  assert.equal(fs.existsSync(ipFile), false);
});
