import { ArkErrors, type } from "arktype";
import { green, grey, yellow } from "kleur/colors";

import { AppConfig, PartialAppConfig } from "./app-config.ts";

export function defineAppConfig(config: typeof PartialAppConfig.infer) {
  const partial = PartialAppConfig(config);

  if (partial instanceof type.errors) {
    // console.log(`Invalid config:\n${makePrettySummary(partial).join("\n")}`);
    throw new Error(`Invalid config:\n${makePrettySummary(partial).join("\n")}`);
  }

  const {
    name: { alphanumeric, display_name, reverse_dns },
  } = partial;

  const full = AppConfig({
    ...partial,
    // TODO: Dynamically grab latest minor version
    react_native_version: "0.82",
    android: {
      application_id: reverse_dns.replaceAll("-", "_"),
      package_namespace: reverse_dns.replaceAll("-", "_"),
      root_project_name: display_name,
      ...partial.android,
    },
    ios: {
      bundle_display_name: display_name,
      bundle_identifier: reverse_dns.replaceAll("_", "-"),
      ...partial.ios,
    },
    macos: {
      bundle_display_name: display_name,
      bundle_identifier: reverse_dns.replaceAll("_", "-"),
      ...partial.macos,
    },
    windows: {
      display_name: display_name,
      namespace: reverse_dns.replaceAll(/[\-_]/g, ""),
      project_name: alphanumeric,
      ...partial.windows,
    },
  } satisfies typeof PartialAppConfig.infer);

  if (full instanceof type.errors) {
    throw new Error(`Invalid config:\n${makePrettySummary(full).join("\n")}`);
  }

  return full;
}

function makePrettySummary({ byPath }: ArkErrors) {
  const summary = new Array<string>();

  for (const [path, error] of Object.entries(byPath)) {
    const actualIndex = error.problem.lastIndexOf(" (was ");
    const problem =
      actualIndex === -1
        ? error.problem
        : `${error.problem.startsWith("must be matched by ") ? `must be matched by ${green(error.problem.slice("must be matched by ".length, actualIndex))}` : error.problem.slice(0, actualIndex)}${grey(error.problem.slice(actualIndex))}`;

    summary.push(`${yellow(path)} ${problem}`);
  }

  return summary;
}
