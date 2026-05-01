import { type } from "arktype";

import { makePrettySummary } from "../arktype.ts";

export async function getPackageInfo(packageName: string) {
  const res = await fetch(`https://registry.npmjs.org/${packageName}`);
  const data = await res.json();

  const response = NpmResponse(data);
  if (response instanceof type.errors) {
    // console.log(`Invalid config:\n${makePrettySummary(partial).join("\n")}`);
    throw new Error(`Invalid config:\n${makePrettySummary(response).join("\n")}`);
  }

  return response;
}

export function filterVersions({
  npmInfo,
  distTag,
  fromMajor,
  fromMinor,
  fromPatch,
  includePrereleases,
}: {
  npmInfo: NpmResponseType;
  distTag?: string;
  fromMajor?: number;
  fromMinor?: number;
  fromPatch?: number;
  includePrereleases?: boolean;
}) {
  const map: VersionsMap = {};
  const { "dist-tags": distTags, versions } = npmInfo;

  if (distTag) {
    const version = distTags[distTag];

    const match = semverMatcher.exec(version);
    if (match) {
      const [fullMatch, major, minor, patch, prerelease, _buildmetadata] = match;
      const majorInt = parseInt(major);
      const minorInt = parseInt(minor);
      const patchInt = parseInt(patch);

      if (!map[majorInt][minorInt][patchInt]) {
        map[majorInt][minorInt][patchInt] = {
          prereleases: [],
        };
      }

      if (!!prerelease) {
        map[majorInt][minorInt][patchInt].prereleases.push(fullMatch);
      } else {
        map[majorInt][minorInt][patchInt].release = fullMatch;
      }
    }

    return { filtered: [version], map };
  }

  const filtered = new Array<string>();
  for (const version of versions) {
    const match = semverMatcher.exec(version);
    if (!match) {
      continue;
    }
    const [fullMatch, major, minor, patch, prerelease, _buildmetadata] = match;
    const majorInt = parseInt(major);
    const minorInt = parseInt(minor);
    const patchInt = parseInt(patch);

    if (typeof fromMajor === "number" && majorInt < fromMajor) {
      continue;
    }
    if (typeof fromMinor === "number" && minorInt < fromMinor) {
      continue;
    }
    if (typeof fromPatch === "number" && patchInt < fromPatch) {
      continue;
    }
    if (!includePrereleases && !!prerelease) {
      continue;
    }
    filtered.push(fullMatch);

    if (!map[majorInt]) {
      map[majorInt] = {};
    }
    if (!map[majorInt][minorInt]) {
      map[majorInt][minorInt] = {};
    }
    if (!map[majorInt][minorInt][patchInt]) {
      map[majorInt][minorInt][patchInt] = {
        prereleases: [],
      };
    }

    if (!!prerelease) {
      map[majorInt][minorInt][patchInt].prereleases.push(fullMatch);
    } else {
      map[majorInt][minorInt][patchInt].release = fullMatch;
    }
  }

  return { filtered, map };
}

type VersionsMap = {
  [major: number]: {
    [minor: number]: { [patch: number]: { release?: string; prereleases: Array<string> } };
  };
};
type HighestStableMinorMap = {
  [major: number]: {
    [minor: number]: string;
  };
};

export function getHighestStableMinors(map: VersionsMap) {
  const minorMap: HighestStableMinorMap = {};

  for (const major in map) {
    const majorInt = parseInt(major);
    if (!minorMap[majorInt]) {
      minorMap[majorInt] = {};
    }

    for (const minor in map[major]) {
      const minorInt = parseInt(minor);

      for (const patch in map[major][minor]) {
        const patchInt = parseInt(patch);
        if (!map[major][minor][patch].release) {
          continue;
        }

        const current = minorMap[majorInt][minorInt];
        if (!current) {
          minorMap[majorInt][minorInt] = map[major][minor][patch].release;
          continue;
        }

        const currentMatch = semverMatcher.exec(current);
        if (!currentMatch) {
          continue;
        }
        const [, , , currentPatch] = currentMatch;

        if (patchInt <= parseInt(currentPatch)) {
          continue;
        }

        minorMap[majorInt][minorInt] = `${major}.${minor}.${patch}`;
      }
    }
  }

  return minorMap;
}

const NpmResponse = type({
  name: "string",
  "dist-tags": "Record<string, string.semver>",

  versions: type("Record<string, Record<string, unknown>>").pipe((record) => Object.keys(record)),

  // Other potentially useful fields that we'll avoid needlessly validating for
  // now:
  // time: "Record<string, string.date.iso>",
});

export type NpmResponseType = typeof NpmResponse.inferOut;

/**
 * Exposing the underlying pattern used by string.semver.
 * @see https://semver.org/
 */
export const semverMatcher =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][\dA-Za-z-]*))*))?(?:\+([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;

export function packageManagerExec(packageManager: "npm" | "bun" | "pnpm") {
  const args = new Array<string>();
  let command: string;
  switch (packageManager) {
    case "bun":
      command = "bunx";
      break;
    case "npm":
      command = "npm";
      args.push("dlx");
      break;
    case "pnpm":
      command = "pnpm";
      args.push("dlx");
  }

  return { args, command };
}
