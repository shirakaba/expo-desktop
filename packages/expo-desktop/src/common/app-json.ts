import { type } from "arktype";

export const ExpoConfig = type({
  "name?": "string",
  "slug?": "string",
  "platforms?": type('"android" | "ios" | "web" | "macos" | "windows"').array(),
  "version?": "string",
  "ios?": type({
    "bundleIdentifier?": "string",
  }),
  "macos?": type({
    "bundleIdentifier?": "string",
  }),
  // "windows?": type({
  //   "projectName?": "string",
  //   "displayName?": "string",
  //   "namespace?": "string",
  // }),
  "android?": type({
    "package?": "string",
  }),
  "plugins?": type(type(["string", "...", "unknown[]"]).or("string")).array(),
});

export const AppJson = type({
  "expo?": ExpoConfig,
});

export const PackageJson = type({
  "name?": "string",
  "scripts?": "Record<string, string>",
  "dependencies?": "Record<string, string>",
  "devDependencies?": "Record<string, string>",
  "peerDependencies?": "Record<string, string>",
  // Not quite sure how to express arbitrarily recursive types in ArkType, so
  // I'll just support two levels for now.
  "overrides?": "Record<string, string | Record<string, string>>",
});
