import { type } from "arktype";

export const SemverMajorMinorOnly = type("/^(\\d+)\\.(\\d+)$/");
export const Dns = type("/^[a-zA-Z][a-zA-Z0-9]*(?:\\.[a-zA-Z][a-zA-Z0-9]*)*$/");
export const UnderscoredDns = type("/^[a-zA-Z]\\w*(?:\\.[a-zA-Z]\\w*)*$/");
export const HyphenatedDns = type("/^[a-zA-Z][a-zA-Z0-9\\-]*(?:\\.[a-zA-Z][a-zA-Z0-9\\-]*)*$/");
export const UnderscoredOrHyphenatedDns = type("/^[a-zA-Z][\\w\\-]*(?:\\.[a-zA-Z][\\w\\-]*)*$/");

// Keep this in sync with AppConfig below.
export const PartialAppConfig = type({
  "react_native_version?": SemverMajorMinorOnly,
  name: {
    alphanumeric: "string.alphanumeric",
    display_name: "string",
    reverse_dns: UnderscoredOrHyphenatedDns,
  },
  ["android?"]: {
    "application_id?": UnderscoredDns,
    "package_namespace?": UnderscoredDns,
    "root_project_name?": "string",
  },
  ["ios?"]: {
    "bundle_display_name?": "string",
    "bundle_identifier?": HyphenatedDns,
  },
  ["macos?"]: {
    "bundle_display_name?": "string",
    "bundle_identifier?": HyphenatedDns,
  },
  ["windows?"]: {
    "display_name?": "string",
    "namespace?": Dns,
    "project_name?": "string.alphanumeric",
  },
});

// Keep this in sync with PartialAppConfig above.
export const AppConfig = type({
  react_native_version: SemverMajorMinorOnly,
  name: {
    alphanumeric: "string.alphanumeric",
    display_name: "string",
    reverse_dns: UnderscoredOrHyphenatedDns,
  },
  android: {
    application_id: UnderscoredDns,
    package_namespace: UnderscoredDns,
    root_project_name: "string",
  },
  ios: {
    bundle_display_name: "string",
    bundle_identifier: HyphenatedDns,
  },
  macos: {
    bundle_display_name: "string",
    bundle_identifier: HyphenatedDns,
  },
  windows: {
    display_name: "string",
    namespace: Dns,
    project_name: "string.alphanumeric",
  },
});
