import { afterEach, expect, test, vi } from "vitest";

import { type NpmResponseType } from "../common/npm.ts";
import { extractTemplateVersions, getTemplateVersions } from "./template-versions.ts";

const samplePackageInfo = {
  name: "expo-desktop-blank-typescript",
  "dist-tags": {
    latest: "55.83.0",
  },
  versions: [
    "54.81.0",
    "54.81.1",
    "54.81.2-beta.0",
    "54.82.1",
    "54.82.3",
    "55.83.0",
    "55.83.1-beta.0",
    "not-a-version",
  ],
} satisfies NpmResponseType;

const samplePackageJson = {
  ...samplePackageInfo,
  versions: Object.fromEntries(samplePackageInfo.versions.map((version) => [version, {}])),
};

const expectedTemplateVersions = {
  55: {
    83: "55.83.0",
  },
  54: {
    81: "54.81.1",
    82: "54.82.3",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("extracts the highest stable template patch for each SDK and React Native minor", () => {
  expect(extractTemplateVersions(samplePackageInfo)).toStrictEqual(expectedTemplateVersions);
});

test("fetches template versions from npm", async () => {
  const fetch = vi.fn(async (url: string) => {
    expect(url).toBe("https://registry.npmjs.org/expo-desktop-template-bare-minimum");
    return {
      json: async () => samplePackageJson,
    };
  });
  vi.stubGlobal("fetch", fetch);

  await expect(getTemplateVersions("expo-desktop-blank-typescript")).resolves.toStrictEqual(
    expectedTemplateVersions,
  );
  expect(fetch).toHaveBeenCalledOnce();
});
