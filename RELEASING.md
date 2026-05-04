# Releasing

Published packages: `expo-desktop`, `expo-desktop-prebuild-config`, and `expo-desktop-config-plugins`. Changelog text comes from [Changesets](https://github.com/changesets/changesets) (`.changeset/*.md`), not from git commit messages.

Other workspace members (`demo-expo-desktop`, `expo-desktop-scripts`) are **`"private": true`** in their `package.json` so **`changeset publish` skips them**. The **`ignore`** list in `.changeset/config.json` only affects which packages Changesets will version from changesets; it does **not** stop publish for non-private packages.

## During development

1. After user-visible changes, add a changeset:

   ```bash
   bun run changeset
   ```

2. Commit the new `.changeset/*.md` file with your work (or in a follow-up commit).

## Cutting a release

1. On `main`, with a clean tree and up to date with `origin`:

   ```bash
   git checkout main && git pull
   ```

2. Apply pending changesets (bumps `package.json`, updates `CHANGELOG.md`, rewrites internal `workspace:` deps to semver, removes consumed changeset files):

   ```bash
   bun run release:version
   ```

3. Review `git diff`.

4. Commit and push to `main`. GitHub Actions runs `changeset publish` when those pushes include the listed packages’ `package.json` or `CHANGELOG.md`.

To **retry publish** for the versions already on `main` (no new `changeset version`), use **Actions → Publish to npm → Run workflow**, or:

```bash
gh workflow run publish.yml --ref main
```

## CI setup

Publishing uses **npm trusted publishing (OIDC)** from GitHub Actions—**no `NPM_TOKEN` secret**. On npmjs.com, each package must list this repo’s **`publish.yml`** workflow as its trusted publisher. The workflow sets **`id-token: write`** and uses **`actions/setup-node`** so `changeset publish` (which invokes **`npm publish`**) runs with the **npm bundled on the chosen Node line**. Trusted publishing requires **npm ≥ 11.5.1**; that comes with **Active LTS Node 24+** (npm 11.x). This workflow uses **`node-version: lts/*`**, which follows the current Active LTS on the runner.

If you later add **private** npm dependencies, use a **read-only** granular token only for install steps; OIDC still handles the publish step ([npm docs](https://docs.npmjs.com/trusted-publishers)).

## Prereleases

Use Changesets [prerelease mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) locally (`changeset pre enter …`, `changeset pre exit`). Configure a non-`latest` dist-tag for prerelease publishes if you use them.
