# Changesets

Add a changeset when a PR has user-facing impact on a published package (`expo-desktop`, `expo-desktop-prebuild-config`, or `expo-desktop-config-plugins`):

```bash
pnpm run changeset
```

When you are ready to release, on an up-to-date `main` branch run `pnpm run release:version`, review the diff, commit, and push. CI publishes to npm when those commits touch the packages’ `package.json` and `CHANGELOG.md`.

See [RELEASING.md](../RELEASING.md) in the repo root for the full flow.
