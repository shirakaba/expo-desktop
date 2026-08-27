# Releasing

These are notes to the maintainer; I don't currently expect contributors to be involved with release management.

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
