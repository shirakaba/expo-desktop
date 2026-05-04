# Releasing

Published packages: `expo-desktop`, `expo-desktop-prebuild-config`, and `expo-desktop-config-plugins`. Changelog text comes from [Changesets](https://github.com/changesets/changesets) (`.changeset/*.md`), not from git commit messages.

Other workspace members (`demo-expo-desktop`, `expo-desktop-scripts`) are **`"private": true`** in their `package.json` so **`changeset publish` skips them**. The **`ignore`** list in `.changeset/config.json` only affects which packages Changesets will version from changesets; it does **not** stop publish for non-private packages.

## During development

1. After user-visible changes, add a changeset:

   ```bash
   pnpm run changeset
   ```

2. Commit the new `.changeset/*.md` file with your work (or in a follow-up commit).

## Cutting a release

1. On `main`, with a clean tree and up to date with `origin`:

   ```bash
   git checkout main && git pull
   ```

2. Apply pending changesets (bumps `package.json`, updates `CHANGELOG.md`, rewrites internal `workspace:` deps to semver, removes consumed changeset files):

   ```bash
   pnpm run release:version
   ```

3. Review `git diff`.

4. Commit and push to `main`. GitHub Actions runs `changeset publish` when those pushes include the listed packages’ `package.json` or `CHANGELOG.md`.

To **retry publish** for the versions already on `main` (no new `changeset version`), use **Actions → Publish to npm → Run workflow**, or:

```bash
gh workflow run publish.yml --ref main
```

## CI setup

Publishing uses **npm trusted publishing (OIDC)** from GitHub Actions—**no `NPM_TOKEN` secret**. On npmjs.com, each package must list this repo’s **`publish.yml`** workflow as its trusted publisher. If npm is configured with a **GitHub Environment** (e.g. **Stable Release**), the **`publish`** job must declare the **same** `environment:` name so OIDC claims match; otherwise publishes can fail with misleading **`E404`** ([npm trusted publishing](https://docs.npmjs.com/trusted-publishers)).

The workflow sets **`id-token: write`** and uses **`actions/setup-node`** with **`node-version: lts/*`** so `changeset publish` (which invokes **`npm publish`**) runs on current Active LTS.

## Prereleases

Use Changesets [prerelease mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) locally (`changeset pre enter …`, `changeset pre exit`). Configure a non-`latest` dist-tag for prerelease publishes if you use them.
