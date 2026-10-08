import assert from "node:assert/strict";
import { test } from "node:test";

import type { Runner } from "./release.ts";

import { getPackageTag, getTagUpdates, syncTags } from "./tags.ts";

function registry(versions: string[], tags: Record<string, string>) {
  const calls: string[][] = [];
  const run: Runner = (command, args) => {
    calls.push([command, ...args]);
    assert.equal(command, "npm");
    assert.ok(args.includes("--registry=https://registry.npmjs.org/"));
    if (args[0] === "view") return JSON.stringify({ versions, "dist-tags": tags });
    assert.equal(args[0], "dist-tag");
    assert.equal(args[1], "add");
    tags[args[3]!] = args[2]!.split("@").at(-1)!;
    return "";
  };
  return { run, calls, tags };
}

test("independent package names always use latest, including after a future major bump", () => {
  for (const branchTag of ["next", "latest", "sdk-54"]) {
    assert.equal(getPackageTag("shared", branchTag, ["shared"]), "latest");
    assert.equal(getPackageTag("sdk-package", branchTag, ["shared"]), branchTag);
  }
});

test("promoting a published version adds one tag without removing other tags and is idempotent", () => {
  const r = registry(["55.0.0"], { next: "55.0.0", "sdk-54": "54.0.9" });
  const packages = [{ name: "sdk-package", version: "55.0.0" }];
  const updates = getTagUpdates(packages, new Set(), () => "latest", r.run);
  assert.deepEqual(updates, [
    { ...packages[0], tag: "latest", published: true, previous: undefined },
  ]);
  syncTags(updates, r.run);
  assert.deepEqual(r.tags, { next: "55.0.0", "sdk-54": "54.0.9", latest: "55.0.0" });
  assert.deepEqual(
    getTagUpdates(packages, new Set(), () => "latest", r.run),
    [],
  );
  assert.equal(r.calls.filter((call) => call[1] === "dist-tag").length, 1);
});

test("older published versions leave newer tags untouched; comparison is semantic, not lexical", () => {
  const r = registry(["1.9.0", "1.10.0"], { latest: "1.10.0" });
  assert.deepEqual(
    getTagUpdates([{ name: "shared", version: "1.9.0" }], new Set(), () => "latest", r.run),
    [],
  );
  r.tags.latest = "1.9.0";
  assert.equal(
    getTagUpdates([{ name: "shared", version: "1.10.0" }], new Set(), () => "latest", r.run).length,
    1,
  );
});

test("an unpublished version cannot downgrade a tag through Changesets publishing", () => {
  const r = registry(["1.10.0"], { latest: "1.10.0" });
  assert.throws(
    () =>
      getTagUpdates(
        [{ name: "shared", version: "1.9.1" }],
        new Set(["shared"]),
        () => "latest",
        r.run,
      ),
    /would move latest backwards/,
  );
  assert.ok(r.calls.every((call) => call[1] === "view"));
});

test("new versions use native publication for tags, and missing versions excluded by Changesets are not promoted", () => {
  const r = registry([], {});
  const packages = [{ name: "new", version: "1.0.0" }];
  assert.deepEqual(
    getTagUpdates(packages, new Set(), () => "latest", r.run),
    [],
  );
  const updates = getTagUpdates(packages, new Set(["new"]), () => "latest", r.run);
  assert.equal(updates[0]!.published, false);
  syncTags(updates, r.run);
  assert.ok(r.calls.every((call) => call[1] === "view"));
});

test("only E404 is a new package; registry, authentication, and malformed-response failures abort", () => {
  const packages = [{ name: "new", version: "1.0.0" }];
  const notFound = Object.assign(new Error("Not found"), {
    stdout: JSON.stringify({ error: { code: "E404" } }),
  });
  const updates = getTagUpdates(
    packages,
    new Set(["new"]),
    () => "latest",
    () => {
      throw notFound;
    },
  );
  assert.equal(updates[0]!.published, false);
  for (const code of ["E401", "E403", "E500", "ENETUNREACH"]) {
    const error = Object.assign(new Error(code), { stdout: JSON.stringify({ error: { code } }) });
    assert.throws(
      () =>
        getTagUpdates(
          packages,
          new Set(["new"]),
          () => "latest",
          () => {
            throw error;
          },
        ),
      new RegExp(code),
    );
  }
  assert.throws(() =>
    getTagUpdates(
      packages,
      new Set(),
      () => "latest",
      () => "invalid json",
    ),
  );
});

test("latest refuses prereleases while next can promote them", () => {
  const r = registry(["56.0.0-beta.1"], {});
  const packages = [{ name: "sdk-package", version: "56.0.0-beta.1" }];
  assert.throws(
    () => getTagUpdates(packages, new Set(), () => "latest", r.run),
    /Use a stable version/,
  );
  assert.equal(getTagUpdates(packages, new Set(), () => "next", r.run)[0]!.tag, "next");
});
