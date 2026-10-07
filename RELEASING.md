# Releasing

We follow Expo's Changesets workflow: develop on `main`, cut SDK branches, and
cherry-pick fixes and their changesets into supported SDK branches. All branches
retain the complete monorepo, including independently versioned tooling.

Reference: Expo's [Changesets branch policy](https://github.com/expo/expo/blob/0ce12a8e8fcde395a1c02c5ba10bcf4f22fd7aac/.changeset/expo.json)
and [release workflow](https://github.com/expo/expo/blob/0ce12a8e8fcde395a1c02c5ba10bcf4f22fd7aac/.github/workflows/publish-packages.yml),
after its Changesets migration. We omit Expo-specific canaries, native
precompilation, and website/version-metadata synchronization.

## Branches and npm tags

| Branch                 | npm tag  | Major changesets |
| ---------------------- | -------- | ---------------- |
| `main`                 | `next`   | Allowed          |
| `sdk-55`               | `latest` | Rejected         |
| `sdk-54`               | `sdk-54` | Rejected         |
| Other `sdk-N` branches | `sdk-N`  | Rejected         |

`.changeset/expo-desktop.json` is the release policy. Set `publish` to `null` to
disable a branch. The workflows also have an explicit branch allowlist; update
both when adding a release branch. `.changeset/config.json` names the branch
it belongs to as `baseBranch`.

`main` is the development trunk, initially based on the SDK 55 tree. Prepare the
next SDK there with explicit version and dependency changes. When that SDK is
stable, change the former stable branch from `latest` to `sdk-N`, and assign
`latest` to the new stable branch. Propagate the policy to all release branches
before publishing. To stop beta publication from `main`, set its `publish` to
`null`, as Expo does after its beta cutoff.

These are npm tags on normal versions, not Changesets prerelease mode. Do not
use `rp enter` for these branches. For example, an SDK 54 backport must never
be published with the default `latest` tag. Stable branches publish to the tag
shown above; they do not automatically add a second SDK alias. Consumers can
always request a major range such as `expo-desktop-stubs@54` or `@55`.

## Normal workflow

Pushes to `main`, `sdk-54`, and `sdk-55` perform real releases: pending changesets
create or update a version PR; otherwise CI builds and publishes unpublished
versions, creates Git tags, and creates GitHub releases. Manual dispatch of
`publish.yml` still defaults to a dry run, which does not create version PRs,
publish packages, or create tags or GitHub releases.

1. Make a code change and run `pnpm -w r1`. Select all affected public packages.
2. Commit the implementation and changeset together, then push directly to the
   release branch or merge a PR.
3. CI creates or updates `Version packages (<branch>)`, containing generated
   package versions, changelogs, and the lockfile.
4. Review and merge that PR. Its push publishes the release: CI builds and runs Changesets'
   native publish command with the branch's npm tag, then creates package Git tags
   and GitHub releases.

To release without a version PR, run `pnpm -w r2` locally after committing your
changesets. Review and commit its generated versions, changelogs, and lockfile,
then push to the release branch to publish when no pending changesets remain
and Changesets finds unpublished versions. A later commit does not prevent this.

For changes that need no release, use `pnpm -w r1 --empty` to acknowledge that
explicitly when the PR changes workspace files.

Changesets compares the current version of each publishable package against npm.
Every unpublished version is eligible, regardless of which commit introduced it;
versions already on npm are skipped. This includes manually bumped versions and
new public packages. Set `private: true` on packages that must not be published.
There is no last-commit filter or requirement to fetch a parent commit to select
a release.

Use patch changesets for normal changes to templates and Metro config: their
minor version encodes React Native (`54.81.x`, `55.83.x`). Other packages use
ordinary semantic versioning. CI rejects major changesets and propagated major
bumps on SDK branches. Changesets updates dependent workspace packages, including
private apps, but private packages are never published or tagged.

For backports, cherry-pick or adapt the code and its changeset. Do not cherry-pick
release commits, generated changelogs, or whole lockfiles. Keep SDK-specific
dependencies on their own branch.

## Independently versioned packages

`expo-desktop`, `expo-desktop-config-plugins`, and `expo-desktop-prebuild-config`
keep their own semver versions and remain workspaces on every branch, like Expo's
independently versioned tooling. Tags do not create separate version namespaces:
`package@1.2.1` can contain only one artifact, regardless of its tag or branch.
The branch's tag applies to these packages too; publishing a shared fix from
`sdk-54` does not move `latest`. Propagate that fix to the stable branch as well.

Land shared fixes on `main` and propagate them to every supported branch where
needed. Preserve backwards compatibility across SDKs; do not publish SDK-specific
behavior that drops support from a shared package. Before versioning, the wrapper
checks npm for collisions. If the calculated version is already published,
reconcile the branch's shared source and version with that release, refresh its
lockfile, and then regenerate the version PR. Do not advance just the number
while discarding shared fixes. A newer shared release must include earlier fixes.

This is deliberate coordination, not an automatic cross-branch merge or global
version allocator. Publishing is serialized across branches, but Changesets
skips versions already on npm without comparing their source or `gitHead`.
Coordinate shared versions before pushing; the versioning preflight is not a
reservation of an npm version. Publishing from another branch does not retag an
already-published version; moving its npm dist-tag is a separate explicit action.
Workspace and catalog dependency ranges are resolved by pnpm when packing.

## CI setup

- CI uses `pnpm/setup@v3` with `version: latest`, `cache: true`,
  `require-lockfile: true`, and `runtime: node@lts`. Dependency versions are resolved
  from the committed `pnpm-lock.yaml`.
- Enable GitHub Actions to create pull requests in repository settings.
- Configure npm trusted publishing for each public package, including templates,
  using `shirakaba/expo-desktop`, workflow `publish.yml`, and environment
  `Stable Release`, with direct publishing allowed. Allow `main`, `sdk-54`, and
  `sdk-55` in the GitHub environment's deployment branch policy.
- Only the publish job has `id-token: write`; PR checks and versioning do not.
- GitHub's default token does not trigger PR workflows for bot-created version
  PRs. If branch protection requires PR checks on version PRs, use a GitHub App
  token for the version action or
  arrange an explicit check run on that PR; do not leave required checks pending.

The workflow filename and environment are kept from the existing trusted-publisher
setup. No npm token is required. Publishing uses Changesets' pnpm support.

## Local inspection and recovery

```sh
pnpm -w r1                              # Add release intent
pnpm -w release:check                   # Validate pending changesets
pnpm --filter expo-desktop-release test # Release policy/integration tests
pnpm --filter expo-desktop-release typecheck
pnpm -w r2                              # Version a clean release branch
# Review and commit the generated changes before publishing.
pnpm -w r3 --dry-run                    # Query npm, build and pack; no writes to npm
```

`r2` updates the lockfile offline without running install hooks or reinstalling
the workspace. Run `pnpm install` explicitly if external dependencies change.
Never use bare `changeset publish` for a release: it defaults to `latest` and
does not apply our branch policy. `r3` builds and delegates to
`changeset publish --tag <branch-tag>`; its dry run builds and packs without
publishing or creating tags.

Manual dispatch of `publish.yml` defaults to a dry run. Select a release branch
with no pending changesets to preview publication. Pushes perform real releases;
dispatch with dry run disabled to publish manually or retry publishing.
With no pending changesets, pushes and manual runs query Changesets' publish plan;
they do nothing when no publications or Git tags are pending.

After a partial publication, push any follow-up fix or manually dispatch with
dry run disabled to retry. Changesets skips already-published versions and
publishes the remaining ones; it does not require the same commit. Successful
packages remain immutable: changes to an already-published package need a new
version.
If npm publication succeeded but Git tags/releases failed, recover those from
the original successful publish action's output; do not republish or move tags.
