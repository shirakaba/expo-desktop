# Changesets

Add release intent for public package changes with `pnpm -w r1`. Select every
affected package and describe the change for package users. Use patch for fixes
and minor for compatible features. Major changes belong on `main`.

The templates and Metro config encode the React Native minor in their versions
(for example, `54.81.x`), so use patch changesets for their ordinary releases.
Change their SDK/React Native line explicitly when preparing a new SDK.

Pushes to a release branch create or update a `Version packages (<branch>)` PR
when changesets are pending. Merge it when ready to release, or run `pnpm -w r2`
locally and commit and push the generated changes directly. With no pending
changesets, pushes publish current package versions that are missing from npm
and synchronize tags on existing versions. SDK-versioned packages use the branch's
tag in [`expo-desktop.json`](./expo-desktop.json); `independentPackages` use only
`latest` on every branch. Existing newer tags are never moved backwards.
Publication does not depend on which commit changed the versions. Do not edit
generated changelogs.

Manual dispatch of `publish.yml` defaults to a dry run: no version PRs,
publications, or tag/release writes. Disable `dry-run` to release manually.

Backport implementation commits and their changesets, not generated version
commits. Each branch calculates its own package versions. For a PR affecting a
package that needs no release, use `pnpm exec changeset --empty`.

See [RELEASING.md](../RELEASING.md) for branch policy, publishing setup, and recovery.
