# Releasing

These are notes to the maintainer; I don't currently expect contributors to be involved with release management.

The workspace uses `verifyDepsBeforeRun: warn` to prevent pnpm from automatically
reinstalling dependencies before running scripts. `r1` and the versioning part of
`r2` invoke Node directly to avoid a second pnpm process and dependency check.
After bumping package versions, `r2` updates only the lockfile, offline and without
install hooks. Release bumps change workspace versions and dependency ranges;
the existing workspace links already point to the updated packages. Reinstalling
the entire hoisted dependency tree is unnecessary and can cause long disk I/O
stalls and registry retries.

Run `pnpm install` explicitly when adding or changing external dependencies or
when setting up a checkout. A version-only release can leave pnpm's installed
workspace state stale, so a later script may warn; that warning does not trigger
an install. If the offline lockfile update fails because a new dependency is not
cached, run `pnpm install` to resolve it before retrying the release command.

From any directory in the monorepo:

```sh
# Generate the changeset (i.e. which packages to bump, and the description).
pnpm -w r1

# Consume it and update the lockfile without reinstalling dependencies.
pnpm -w r2

# Optionally validate the template tarballs without contacting the registry or
# publishing anything.
pnpm -w r3 --dry-run

# Finally, commit and push it to `main` and it will trigger a release.
```
