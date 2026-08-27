import fs from "node:fs/promises";
import path from "node:path";

import type { ExtraPackageGitTag } from "./changeset-publish.ts";

// A light adaptation of changesets/action@v2.1.1's GitHub tag and Release
// behavior for template packages that its workspace-only lookup cannot resolve.
//
// Sources:
// - https://github.com/changesets/action/blob/v2.1.1/src/utils.ts
// - https://github.com/changesets/action/blob/v2.1.1/src/run.ts
// - https://github.com/changesets/action/blob/v2.1.1/src/github.ts
// License: ../LICENSE-changesets-action

type GitHubContext = {
  apiUrl: string;
  repository: string;
  sha: string;
  token: string;
};

type Fetch = typeof globalThis.fetch;

export function readGitHubContext(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GitHubContext {
  const apiUrl = env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = env.GITHUB_REPOSITORY;
  const sha = env.GITHUB_SHA;
  const token = env.GITHUB_TOKEN;

  if (repository == null || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error("GITHUB_REPOSITORY must identify the current GitHub owner and repository.");
  }
  if (sha == null || sha.length === 0) {
    throw new Error("GITHUB_SHA must identify the commit being released.");
  }
  if (token == null || token.length === 0) {
    throw new Error("GITHUB_TOKEN is required to publish template tags and GitHub Releases.");
  }

  return {
    apiUrl: new URL(apiUrl).href.replace(/\/$/, ""),
    repository,
    sha,
    token,
  };
}

export async function createTemplateGitHubReleases(
  tags: readonly ExtraPackageGitTag[],
  context: GitHubContext,
  fetchImplementation: Fetch = fetch,
): Promise<void> {
  const preparedReleases = await Promise.all(
    tags.map(async ({ event, pkg }) => {
      const { name, version } = pkg.packageJson;
      const expectedTag = `${name}@${version}`;
      if (event.packageName !== name || event.tag !== expectedTag) {
        throw new Error(
          `Template release event ${event.tag} does not match ${name}@${version} in ${pkg.relativeDir}.`,
        );
      }

      const changelogPath = path.join(pkg.dir, "CHANGELOG.md");
      const changelog = await fs.readFile(changelogPath, "utf8");
      return {
        body: getChangelogEntry(changelog, version),
        prerelease: version.includes("-"),
        tag: event.tag,
      };
    }),
  );

  const duplicateTags = preparedReleases
    .map(({ tag }) => tag)
    .filter((tag, index, allTags) => allTags.indexOf(tag) !== index);
  if (duplicateTags.length > 0) {
    throw new Error(`Cannot create duplicate template releases: ${duplicateTags.join(", ")}.`);
  }

  for (const release of preparedReleases) {
    await createTag(release.tag, context, fetchImplementation);
    await createRelease(release, context, fetchImplementation);
    console.info(`Created GitHub Release ${release.tag}.`);
  }
}

function getChangelogEntry(changelog: string, version: string): string {
  let headingStart: { depth: number; index: number } | undefined;
  let endIndex: number | undefined;
  const headingOrCodeBlock = /^(#{1,6})\s(.*)$|^(`{3,})/gm;
  let match: RegExpExecArray | null;

  while ((match = headingOrCodeBlock.exec(changelog)) != null) {
    if (match[3]) {
      const codeBlockEnd = new RegExp(`^${match[3]}`, "gm");
      codeBlockEnd.lastIndex = headingOrCodeBlock.lastIndex;
      const endMatch = codeBlockEnd.exec(changelog);
      if (endMatch == null) break;
      headingOrCodeBlock.lastIndex = codeBlockEnd.lastIndex;
      continue;
    }

    const depth = match[1].length;
    const heading = match[2].trim();
    if (heading === version) {
      headingStart = { depth, index: headingOrCodeBlock.lastIndex };
      continue;
    }
    if (headingStart != null && depth === headingStart.depth) {
      endIndex = match.index;
      break;
    }
  }

  if (headingStart == null) {
    throw new Error(`Could not find changelog entry for template version ${version}.`);
  }
  return changelog.slice(headingStart.index, endIndex).trim();
}

async function createTag(tag: string, context: GitHubContext, fetchImplementation: Fetch) {
  const response = await githubRequest(
    `/repos/${context.repository}/git/refs`,
    {
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha: context.sha }),
      method: "POST",
    },
    context,
    fetchImplementation,
  );
  if (response.ok) return;

  // A retry can encounter a tag created by an earlier, partially successful run.
  if (response.status === 422) {
    const existing = await githubRequest(
      `/repos/${context.repository}/git/ref/tags/${encodeGitRef(tag)}`,
      { method: "GET" },
      context,
      fetchImplementation,
    );
    if (existing.ok) return;
  }
  throw await githubResponseError(`create tag ${tag}`, response);
}

async function createRelease(
  release: { body: string; prerelease: boolean; tag: string },
  context: GitHubContext,
  fetchImplementation: Fetch,
) {
  const response = await githubRequest(
    `/repos/${context.repository}/releases`,
    {
      body: JSON.stringify({
        body: release.body,
        name: release.tag,
        prerelease: release.prerelease,
        tag_name: release.tag,
      }),
      method: "POST",
    },
    context,
    fetchImplementation,
  );
  if (response.ok) return;
  throw await githubResponseError(`create GitHub Release ${release.tag}`, response);
}

function githubRequest(
  pathname: string,
  init: RequestInit,
  context: GitHubContext,
  fetchImplementation: Fetch,
) {
  return fetchImplementation(`${context.apiUrl}${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

async function githubResponseError(action: string, response: Response): Promise<Error> {
  const body = (await response.text()).slice(0, 1_000);
  return new Error(
    `Failed to ${action}: GitHub returned ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`,
  );
}

function encodeGitRef(tag: string): string {
  return tag.split("/").map(encodeURIComponent).join("/");
}
