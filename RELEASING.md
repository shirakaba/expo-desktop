# Releasing

These are notes to the maintainer; I don't currently expect contributors to be involved with release management.

From any directory in the monorepo:

```sh
# Generate the changeset (i.e. which packages to bump, and the description).
pnpm -w changeset

# Consume it.
pnpm -w release:version

# Finally, commit and push it to `main` and it will trigger a release.
```
