const assert = require("assert");
const { createRunOncePlugin } = require("@expo/config-plugins");
const { withMacOSViewController } = require("./macos-plugins");

const INSERT_PATTERN = "NSView *view = [self view];";

/**
 * Sets the initial NSView frame size (Objective-C `ViewController.m` only).
 *
 * @type {import("@expo/config-plugins").ConfigPlugin<{ width?: number; height?: number }>}
 */
function withWindowSize(c, { width = 800, height = 600 } = {}) {
  return withMacOSViewController(c, (config) => {
    assert(
      config.modResults.language === "objc",
      "View controller must be Objective-C to use withWindowSize.",
    );

    const insertText = `[view setFrameSize:NSMakeSize(${width}, ${height})];`;

    config.modResults.contents = config.modResults.contents.replace(
      INSERT_PATTERN,
      `${INSERT_PATTERN}\n  ${insertText}`,
    );

    return config;
  });
}

module.exports = createRunOncePlugin(withWindowSize, "withWindowSize", "1.0.0");
