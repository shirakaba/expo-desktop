import { default as kleur } from "kleur";
import { green, grey } from "kleur/colors";
import prompts from "prompts";

import { env } from "../common/expo/env.ts";
import { Log } from "../common/expo/log.ts";
import {
  filterVersions,
  getHighestStableMinors,
  getPackageInfo,
  type NpmResponseType,
} from "../common/npm.ts";

export async function selectTemplateVersion({
  defaultPackageName: packageName,
  template,
  version,
  yes,
}: {
  defaultPackageName: string;
  template?: string | undefined;
  version: string | undefined;
  yes: boolean;
}) {
  if (template) {
    return template;
  }

  const nonInteractive = yes || env.CI || !process.stdin.isTTY;
  if (nonInteractive) {
    return `${packageName}@latest`;
  }

  let versions: TemplateVersions;
  try {
    versions = await getTemplateVersions(packageName);
  } catch (error) {
    Log.error(`Error fetching package versions for ${packageName}`);
    return `${packageName}@latest`;
  }

  const choices = [
    ...Object.entries(versions)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .flatMap(([expoSdkMajor, reactNativeMinors]) => {
        return Object.entries(reactNativeMinors)
          .sort(([a], [b]) => parseInt(b) - parseInt(a))
          .map(([minor, fullVersion]) => ({
            title: `Expo SDK ${expoSdkMajor}, React Native 0.${minor} (template v${fullVersion})`,
            value: fullVersion,
          }));
      }),
  ];
  if (!choices.length) {
    throw new Error(`Found no published versions for template "${packageName}".`);
  }

  if (version) {
    const match = choices.find(({ value: fullVersion }) =>
      fullVersion.startsWith(`${version}.`),
    )?.value;
    if (match) {
      return `${packageName}@${match}`;
    }

    console.log(`Unable to find a template for requested Expo SDK version ${version}.`);
  } else if (choices.length === 1) {
    const { title, value } = choices[0];
    console.log(`Only one version of template available: ${title}. Auto-selecting.`);
    return `${packageName}@${value}`;
  }

  const { answer } = await prompts({
    type: "select",
    name: "answer",
    message: `Which version of ${kleur.bold(packageName)} shall we install?`,
    choices,
    initial: 0,
  });
  return `${packageName}@${answer}`;
}

/**
 * Fetch the published template versions via the npm API.
 */
export async function getTemplateVersions(packageName: string): Promise<TemplateVersions> {
  const npmInfo = await getPackageInfo(packageName);
  return extractTemplateVersions(npmInfo);
}

/**
 * Extract the highest stable template version for each Expo SDK and React
 * Native minor version from npm package metadata.
 */
export function extractTemplateVersions(npmInfo: NpmResponseType): TemplateVersions {
  const { map } = filterVersions({ npmInfo, includePrereleases: false });
  return getHighestStableMinors(map);
}

export type TemplateVersions = {
  [expoSdkMajor: number]: {
    [reactNativeMinor: number]: string;
  };
};
