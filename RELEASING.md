# Releasing

These are notes to the maintainer; I don't currently expect contributors to be involved with release management.

The workspace uses `verifyDepsBeforeRun: warn` to prevent pnpm from automatically
reinstalling dependencies before running scripts. After bumping package versions,
`r2` runs `pnpm install` to update both the lockfile and installed dependencies.
Run `pnpm install` explicitly when dependencies change outside this release flow.

From any directory in the monorepo:

```sh
# Generate the changeset (i.e. which packages to bump, and the description).
pnpm -w r1

# Consume it, update the lockfile, and install dependencies.
pnpm -w r2

# Optionally validate the template tarballs without contacting the registry or
# publishing anything.
pnpm -w r3 --dry-run

# Finally, commit and push it to `main` and it will trigger a release.
```
