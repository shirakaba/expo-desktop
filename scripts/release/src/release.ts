import { getPackages } from "@manypkg/get-packages";
import { execFileSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPackageTag, getTagUpdates, syncTags } from "./tags.ts";

type Policy = { publish: string | null; allowMajor: boolean };
type Config = {
  branches: Record<string, Policy>;
  sdkBranchDefaults: Policy;
  independentPackages: string[];
};
type Release = { name: string; oldVersion: string; newVersion: string; type?: string };
type Status = {
  changesets: { releases: { name: string; type: string }[] }[];
  releases: Release[];
};
type PublishPlan = {
  version: number;
  plan: { kind: "publish" | "tag-only"; name: string; version: string; tag?: string }[][];
};
export type Runner = (command: string, args: string[], capture?: boolean) => string;

export function getPolicy(config: Config, branch: string): Policy {
  const policy =
    config.branches[branch] ?? (/^sdk-\d+$/.test(branch) ? config.sdkBranchDefaults : undefined);
  if (!policy || typeof policy.allowMajor !== "boolean") {
    throw new Error(`No release policy for branch ${branch}.`);
  }
  const publish = policy.publish?.replaceAll("{branch}", branch) ?? null;
  if (publish !== null && !/^[a-z][a-z0-9-]*$/.test(publish)) {
    throw new Error(`Invalid npm tag for ${branch}: ${publish}`);
  }
  return { ...policy, publish };
}

export function validateReleasePlan(status: Status, policy: Policy): void {
  if (!policy.allowMajor) {
    const majors = status.changesets
      .flatMap((entry) => entry.releases)
      .filter((release) => release.type === "major");
    const propagated = status.releases.filter(
      (release) => release.oldVersion.split(".")[0] !== release.newVersion.split(".")[0],
    );
    if (majors.length || propagated.length) {
      throw new Error("Major bumps belong on main, not on an SDK release branch.");
    }
  }
  for (const release of status.releases) {
    // The minor component of these packages represents React Native, not a feature bump.
    if (
      (release.name.startsWith("expo-desktop-template-") ||
        release.name === "expo-desktop-metro-config") &&
      release.type === "minor"
    ) {
      throw new Error(
        `${release.name} encodes React Native in its minor version. Use a patch changeset; change SDK/RN lines explicitly.`,
      );
    }
  }
}

export async function runRelease(
  command: "check" | "mode" | "version" | "publish",
  options: { cwd: string; dryRun?: boolean; since?: string; env?: NodeJS.ProcessEnv; run?: Runner },
): Promise<void> {
  const { cwd, dryRun = false } = options;
  const env = options.env ?? process.env;
  const run: Runner =
    options.run ??
    ((command, args, capture = false) =>
      execFileSync(command, args, {
        cwd,
        env,
        encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
        maxBuffer: 16 * 1024 * 1024,
      }) ?? "");
  const git = (...args: string[]) => run("git", args, true).trim();
  const changeset = (...args: string[]) =>
    run(process.execPath, [fileURLToPath(import.meta.resolve("@changesets/cli/bin.js")), ...args]);
  const json = async (file: string) => JSON.parse(await readFile(file, "utf8"));
  const branch = env.GITHUB_BASE_REF || env.GITHUB_REF_NAME || git("branch", "--show-current");
  const config: Config = await json(path.join(cwd, ".changeset/expo-desktop.json"));
  const policy = getPolicy(config, branch);
  const pending = (await readdir(path.join(cwd, ".changeset"))).filter(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  const setMode = async (mode: string) => {
    console.log(`Release mode for ${branch}: ${mode}`);
    if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `mode=${mode}\n`);
  };
  if (command === "mode" && policy.publish === null) {
    await setMode("none");
    return;
  }
  if (command !== "check" && !policy.publish)
    throw new Error(`Publishing is disabled for ${branch}.`);
  if (
    await stat(path.join(cwd, ".changeset/pre.json")).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(
      "Exit Changesets prerelease mode first. These release branches use npm tags, not prerelease mode.",
    );
  }

  if (command === "mode" && pending.length) {
    await setMode("version");
    return;
  }
  if (command !== "check" && command !== "mode" && git("status", "--porcelain")) {
    throw new Error("Release commands require a clean working tree. Commit changes first.");
  }
  if (command === "publish" && pending.length) {
    throw new Error("Consume all pending changesets and commit the versions before publishing.");
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), "expo-desktop-release-"));
  try {
    if (command === "check" || command === "version") {
      const statusFile = path.join(directory, "status.json");
      changeset(
        "status",
        ...(options.since ? ["--since", options.since] : []),
        "--output",
        statusFile,
      );
      const status: Status = await json(statusFile);
      validateReleasePlan(status, policy);
      if (command === "check" || !pending.length) return;
      // Version PRs on separate branches must not silently reuse a shared package's version.
      const publicPackages = new Set(
        (await getPackages(cwd)).packages
          .filter((pkg) => !pkg.packageJson.private)
          .map((pkg) => pkg.packageJson.name),
      );
      for (const release of status.releases) {
        if (release.type === "none" || !publicPackages.has(release.name)) continue;
        let versions: string | string[];
        try {
          versions = JSON.parse(
            run(
              "npm",
              [
                "view",
                release.name,
                "versions",
                "--json",
                "--registry=https://registry.npmjs.org/",
              ],
              true,
            ),
          );
        } catch (error) {
          // A new public package has no registry history. Other registry failures must abort.
          const stdout = (error as { stdout?: string }).stdout;
          let code: string | undefined;
          try {
            code = JSON.parse(stdout ?? "{}").error?.code;
          } catch {
            /* not npm JSON */
          }
          if (code !== "E404") throw error;
          versions = [];
        }
        if ([versions].flat().includes(release.newVersion)) {
          throw new Error(
            `${release.name}@${release.newVersion} is already published. Reconcile this branch's source and version with the published release before versioning.`,
          );
        }
      }
      changeset("version");
      run("pnpm", ["install", "--lockfile-only", "--offline", "--ignore-scripts"]);
      return;
    }

    const planFile = path.join(directory, "publish-plan.json");
    changeset("publish-plan", "--output", planFile);
    const publishPlan: PublishPlan = await json(planFile);
    const plan = publishPlan.plan.flat();
    const tagFor = (name: string) =>
      getPackageTag(name, policy.publish!, config.independentPackages);
    const updates = getTagUpdates(
      (await getPackages(cwd)).packages
        .filter((pkg) => !pkg.packageJson.private)
        .map((pkg) => pkg.packageJson),
      new Set(plan.filter((entry) => entry.kind === "publish").map((entry) => entry.name)),
      tagFor,
      run,
    );
    if (command === "mode") {
      await setMode(plan.length || updates.length ? "publish" : "none");
      return;
    }
    if (!plan.length && !updates.length) {
      console.log("No unpublished packages, pending Git tags, or npm tag updates.");
      return;
    }
    for (const { name, version, tag, previous, published } of updates) {
      console.log(
        `${published ? "Promote" : "Publish"} ${name}@${version}: ${tag} ${previous ?? "(unset)"} -> ${version}`,
      );
    }
    if (plan.length) {
      // Preserve Changesets' package selection and dependency order; override only npm tags.
      for (const entry of plan) {
        if (entry.kind === "publish") entry.tag = tagFor(entry.name);
      }
      await writeFile(planFile, JSON.stringify(publishPlan));
      if (plan.some((entry) => entry.kind === "publish")) {
        run("pnpm", ["--filter", "expo-desktop...", "build"]);
      }
      const packedDirectory = path.join(directory, "packed");
      changeset("pack", "--from-publish-plan", planFile, "--out-dir", packedDirectory);
      if (!dryRun) changeset("publish", "--from-pack-dir", packedDirectory);
    }
    if (dryRun) {
      console.log("Dry run complete: nothing published or tagged.");
      return;
    }
    syncTags(updates, run);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
