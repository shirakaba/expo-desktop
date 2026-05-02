const { getPbxproj } = require("./Xcodeproj");
const { withXcodeProject } = require("./macos-plugins");

/**
 * @typedef {{ Debug: Record<string, string>; Release: Record<string, string>; base: Record<string, string>; }} BuildSettings
 */

/**
 * @param {Parameters<import("@expo/config-plugins").ConfigPlugin>[0]} config
 * @param {{ }} props
 * @returns {import("@expo/config-plugins").ExportedConfig}
 */
function withExpoXcodeBuildPhase(config, props) {
  config = withXcodeProject(config, (config) => {
    // This build phase is already set up in the Expo iOS bare-minimum template
    // to begin with.
    if (config.modRequest.platform !== "macos") {
      return config;
    }

    const project = getPbxproj(config.modRequest.projectRoot, config.modRequest.platform);
    const { PBXShellScriptBuildPhase } = project.hash.project.objects;
    if (!PBXShellScriptBuildPhase) {
      throw new Error(
        "Expected Xcode project to have one or more PBXShellScriptBuildPhase values.",
      );
    }

    /** @type {{ buildActionMask: number; files: Array<string>; inputPaths: Array<unknown>; isa: "PBXShellScriptBuildPhase"; name: string; outputPaths: Array<unknown>; runOnlyForDeploymentPostprocessing: number; shellPath: string; shellScript: string; }} */
    let reactNativeBuildPhase;
    for (const [key, value] of Object.entries(PBXShellScriptBuildPhase)) {
      if (key.endsWith("_comment")) {
        continue;
      }
      if (
        !value ||
        typeof value !== "object" ||
        !("isa" in value) ||
        value.isa !== "PBXShellScriptBuildPhase" ||
        !("name" in value)
      ) {
        continue;
      }

      // There's likely no need to trim the name or test the unquoted name, but
      // we check both out of an abundance of distrust for Xcode.
      const trimmedName = value.name.trim();
      if (
        trimmedName === "Bundle React Native code and images" ||
        trimmedName === '"Bundle React Native code and images"'
      ) {
        reactNativeBuildPhase = value;
        break;
      }
    }

    if (!reactNativeBuildPhase) {
      throw new Error(
        "Unable to find build phase named 'Bundle React Native code and images' in Xcode project.",
      );
    }

    let shellScript =
      `
if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then
  source "$PODS_ROOT/../.xcode.env"
fi
if [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then
  source "$PODS_ROOT/../.xcode.env.local"
fi

# The project root by default is one level up from the ios directory
export PROJECT_ROOT="$PROJECT_DIR"/..

if [[ "$CONFIGURATION" = *Debug* ]]; then
  export SKIP_BUNDLING=1
fi
if [[ -z "$ENTRY_FILE" ]]; then
  # Set the entry JS file using the bundler's entry resolution.
  export ENTRY_FILE="$("$NODE_BINARY" -e "require('expo/scripts/resolveAppEntry')" "$PROJECT_ROOT" ios relative | tail -n 1)"
fi

if [[ -z "$CLI_PATH" ]]; then
  # Use Expo CLI
  export CLI_PATH="$("$NODE_BINARY" --print "require.resolve('@expo/cli')")"
fi
if [[ -z "$BUNDLE_COMMAND" ]]; then
  # Default Expo CLI command for bundling
  export BUNDLE_COMMAND="export:embed"
fi

\`"$NODE_BINARY" --print "require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'"\`
    `.trim() + "\n";

    // We escape line breaks as Xcode will otherwise do it anyway the moment
    // someone edits the script via the GUI.
    shellScript = shellScript.replaceAll("\n", "\\n");
    reactNativeBuildPhase.shellScript = shellScript;

    config.modResults = project;

    return config;
  });

  return config;
}
module.exports.withExpoXcodeBuildPhase = withExpoXcodeBuildPhase;
