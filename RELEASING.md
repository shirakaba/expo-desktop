# Releasing

Published packages: `expo-desktop`, `expo-desktop-prebuild-config`, and `expo-desktop-config-plugins`. Changelog text comes from [Changesets](https://github.com/changesets/changesets) (`.changeset/*.md`), not from git commit messages.

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

## CI setup

Add an npm automation or granular access token as repository secret **`NPM_TOKEN`**. The publish workflow uses `NODE_AUTH_TOKEN` with the npm registry.

## Prereleases

Use Changesets [prerelease mode](https://github.com/changesets/changesets/blob/main/docs/prereleases.md) locally (`changeset pre enter …`, `changeset pre exit`). Configure a non-`latest` dist-tag for prerelease publishes if you use them.
