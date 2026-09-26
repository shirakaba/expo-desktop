# Releasing

These are notes to the maintainer; I don't currently expect contributors to be involved with release management.

The workspace uses `verifyDepsBeforeRun: warn` to prevent pnpm from automatically
reinstalling dependencies before running scripts. Version bumps from `r2` can
make pnpm's installed workspace state stale even after its lockfile-only install,
so the next script may warn. Run `pnpm install` when dependencies change or to
refresh that state.

From any directory in the monorepo:

```sh
# Generate the changeset (i.e. which packages to bump, and the description).
pnpm -w r1

# Consume it.
pnpm -w r2

# Optionally validate the template tarballs without contacting the registry or
# publishing anything.
pnpm -w r3 --dry-run

# Finally, commit and push it to `main` and it will trigger a release.
```
