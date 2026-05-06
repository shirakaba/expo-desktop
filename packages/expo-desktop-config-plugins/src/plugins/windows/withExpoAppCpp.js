const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");
const { addWarningWindows } = require("../macos/_utils/warnings");

/**
 * @param {import("@expo/config-types").ExpoConfig} config
 * @param {{ windowTitle?: string }} props
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withExpoAppCpp(config, props = {}) {
  return withDangerousMod(config, [
    "windows",
    async (config) => {
      const projectRoot = config.modRequest?.projectRoot ?? config._internal?.projectRoot;
      if (typeof projectRoot !== "string") {
        return config;
      }

      const windowsRoot = path.join(projectRoot, "windows");
      if (!fs.existsSync(windowsRoot)) {
        return config;
      }

      const projectDir = guessWindowsProjectDir(windowsRoot);
      if (!projectDir) {
        addWarningWindows(
          "windows",
          `[with-expo-app-cpp] Could not find a Windows native project folder under "${windowsRoot}".`,
        );
        return config;
      }

      const projectName = path.basename(projectDir);
      const cppPath = path.join(projectDir, `${projectName}.cpp`);
      if (!fs.existsSync(cppPath)) {
        addWarningWindows(
          "windows",
          `[with-expo-app-cpp] Could not find expected App.cpp file at "${cppPath}".`,
        );
        return config;
      }

      let contents = fs.readFileSync(cppPath, "utf8");

      try {
        contents = rewriteComponentName(contents);
      } catch (error) {
        if (error?.code === "ERR_NO_MATCH") {
          addWarningWindows(
            "windows",
            `[with-expo-app-cpp] Cannot set React component name because the App.cpp did not contain the expected "viewOptions.ComponentName(...)" call.`,
          );
        } else {
          throw error;
        }
      }

      try {
        contents = rewriteJavaScriptBundleFile(contents);
      } catch (error) {
        if (error?.code === "ERR_NO_MATCH") {
          addWarningWindows(
            "windows",
            `[with-expo-app-cpp] Cannot set JavaScript bundle root because the App.cpp did not contain the expected "settings.JavaScriptBundleFile(...)" call.`,
          );
        } else {
          throw error;
        }
      }

      if (props.windowTitle) {
        try {
          contents = rewriteWindowTitle(contents, { windowTitle: props.windowTitle });
        } catch (error) {
          if (error?.code === "ERR_NO_MATCH") {
            addWarningWindows(
              "windows",
              `[with-expo-app-cpp] Cannot set window title because the App.cpp did not contain the expected "appWindow.Title(...)" call.`,
            );
          } else {
            throw error;
          }
        }
      }

      fs.writeFileSync(cppPath, contents);
      return config;
    },
  ]);
}

module.exports.withExpoAppCpp = withExpoAppCpp;

function guessWindowsProjectDir(windowsRoot) {
  try {
    const entries = fs.readdirSync(windowsRoot, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    // Prefer a folder that looks like a standard RNW app project:
    // windows/<ProjectName>/<ProjectName>.vcxproj
    for (const dir of dirs) {
      const full = path.join(windowsRoot, dir);
      const vcxproj = path.join(full, `${dir}.vcxproj`);
      if (fs.existsSync(vcxproj)) {
        return full;
      }
    }

    // Fall back to the first directory if there is exactly one.
    if (dirs.length === 1) {
      return path.join(windowsRoot, dirs[0]);
    }
  } catch {
    // ignore
  }

  return null;
}

function escapeCppWideString(value) {
  // Minimal escaping for a wide string literal in C++: L"..."
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function replaceOrThrow(contents, regex, replacement) {
  if (!regex.test(contents)) {
    const error = new Error(`Failed to match "${regex}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }
  return contents.replace(regex, replacement);
}

function rewriteWindowTitle(contents, { windowTitle }) {
  const escaped = escapeCppWideString(windowTitle);
  return replaceOrThrow(
    contents,
    /appWindow\.Title\(L"[^"]*"\);\s*/m,
    `appWindow.Title(L"${escaped}");\n`,
  );
}

function rewriteComponentName(contents) {
  return replaceOrThrow(
    contents,
    /viewOptions\.ComponentName\(L"[^"]*"\);\s*/m,
    `viewOptions.ComponentName(L"main");\n`,
  );
}

function rewriteJavaScriptBundleFile(contents) {
  // cpp-app templates often set this in both `#if BUNDLE` and `#else` branches.
  const pattern = /settings\.JavaScriptBundleFile\(L"index"\);\s*/g;
  if (!pattern.test(contents)) {
    const error = new Error(`Failed to match "${pattern}" in contents:\n${contents}`);
    error.code = "ERR_NO_MATCH";
    throw error;
  }
  pattern.lastIndex = 0;
  return contents.replaceAll(
    pattern,
    `settings.JavaScriptBundleFile(L".expo/.virtual-metro-entry");\n`,
  );
}
