import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createTemplateGitHubReleases, readGitHubContext } from "./template-github-releases.ts";
import { getTemplatePackages } from "./template-packages.ts";
import { writeTemplateFixtures } from "./test-fixtures.ts";

test("reads the GitHub Actions release context", () => {
  assert.deepEqual(
    readGitHubContext({
      GITHUB_API_URL: "https://github.example/api/v3/",
      GITHUB_REPOSITORY: "owner/repository",
      GITHUB_SHA: "abc123",
      GITHUB_TOKEN: "secret",
    }),
    {
      apiUrl: "https://github.example/api/v3",
      repository: "owner/repository",
      sha: "abc123",
      token: "secret",
    },
  );
  assert.throws(
    () => readGitHubContext({ GITHUB_REPOSITORY: "owner/repository", GITHUB_SHA: "abc123" }),
    /GITHUB_TOKEN/,
  );
});

test("creates a tag and prerelease for a template package", async () => {
  await using fixture = await templateReleaseFixture();
  const pkg = fixture.templates[0];
  const tag = `${pkg.packageJson.name}@${pkg.packageJson.version}`;
  const calls = new Array<{ body: unknown; method: string; url: string }>();
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({
      body: init?.body == null ? undefined : JSON.parse(String(init.body)),
      method: init?.method ?? "GET",
      url: String(input),
    });
    return new Response("{}", { status: 201 });
  };

  await createTemplateGitHubReleases(
    [{ event: { packageName: pkg.packageJson.name, tag, type: "git-tag" }, pkg }],
    {
      apiUrl: "https://api.github.test",
      repository: "owner/repository",
      sha: "abc123",
      token: "secret",
    },
    fakeFetch,
  );

  assert.deepEqual(calls, [
    {
      body: { ref: `refs/tags/${tag}`, sha: "abc123" },
      method: "POST",
      url: "https://api.github.test/repos/owner/repository/git/refs",
    },
    {
      body: {
        body: "### Patch Changes\n\n- Fixed the template.",
        name: tag,
        prerelease: true,
        tag_name: tag,
      },
      method: "POST",
      url: "https://api.github.test/repos/owner/repository/releases",
    },
  ]);
});

test("continues a partially successful retry when the template tag already exists", async () => {
  await using fixture = await templateReleaseFixture();
  const pkg = fixture.templates[0];
  const tag = `${pkg.packageJson.name}@${pkg.packageJson.version}`;
  const statuses = [422, 200, 201];
  const calls = new Array<string>();
  const fakeFetch: typeof fetch = async (input) => {
    calls.push(String(input));
    return new Response("{}", { status: statuses.shift() });
  };

  await createTemplateGitHubReleases(
    [{ event: { packageName: pkg.packageJson.name, tag, type: "git-tag" }, pkg }],
    {
      apiUrl: "https://api.github.test",
      repository: "owner/repository",
      sha: "abc123",
      token: "secret",
    },
    fakeFetch,
  );

  assert.deepEqual(calls, [
    "https://api.github.test/repos/owner/repository/git/refs",
    `https://api.github.test/repos/owner/repository/git/ref/tags/${encodeURIComponent(tag)}`,
    "https://api.github.test/repos/owner/repository/releases",
  ]);
});

async function templateReleaseFixture() {
  const rootDir = await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-template-release-test-"));
  await writeTemplateFixtures(rootDir);
  const templates = await getTemplatePackages(rootDir);
  templates[0] = {
    ...templates[0],
    packageJson: {
      ...templates[0].packageJson,
      version: `${templates[0].packageJson.version}-beta.0`,
    },
  };
  await fs.writeFile(
    path.join(templates[0].dir, "CHANGELOG.md"),
    `# ${templates[0].packageJson.name}

## ${templates[0].packageJson.version}

### Patch Changes

- Fixed the template.

## 1.0.0

- Older release.
`,
  );

  return {
    rootDir,
    templates,
    async [Symbol.asyncDispose]() {
      await fs.rm(rootDir, { force: true, recursive: true });
    },
  } satisfies AsyncDisposable & {
    rootDir: string;
    templates: Awaited<ReturnType<typeof getTemplatePackages>>;
  };
}
