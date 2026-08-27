import path from "node:path";

import { publish, type ExtraPackageGitTag } from "./changeset-publish.ts";
import { publishDryRun } from "./publish-dry-run.ts";
import { createTemplateGitHubReleases, readGitHubContext } from "./template-github-releases.ts";
import { getTemplatePackages } from "./template-packages.ts";

const monorepoRoot = path.resolve(import.meta.dirname, "../../..");
const extraPackages = await getTemplatePackages(monorepoRoot);

if (process.argv.includes("--dry-run")) {
  await publishDryRun({ cwd: monorepoRoot, extraPackages });
} else {
  const changesetsOutput = process.env.CHANGESETS_OUTPUT;
  const templateGitTags = new Array<ExtraPackageGitTag>();
  const githubContext = changesetsOutput == null ? undefined : readGitHubContext();

  await publish({
    cwd: monorepoRoot,
    extraPackages,
    onExtraPackageGitTag: githubContext == null ? undefined : (tag) => templateGitTags.push(tag),
    output: changesetsOutput,
  });

  if (githubContext != null) {
    await createTemplateGitHubReleases(templateGitTags, githubContext);
  }
}
