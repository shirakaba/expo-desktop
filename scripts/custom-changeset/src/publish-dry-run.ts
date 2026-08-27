// A packaging check used by the local release script. This is not part of the
// Changesets publish fork and does not inspect or mutate npm/git state.

import type { Config, Packages } from "@changesets/types";
import type { Package as ManyPkgPackage } from "@manypkg/tools";

import { shouldSkipPackage } from "@changesets/should-skip-package";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPackageJsonUrl = import.meta.resolve("@changesets/cli/package.json");

const {
  t: readConfig,
}: {
  t(packages: Packages): Promise<Config>;
} = await import(new URL("./dist/read-config.mjs", cliPackageJsonUrl).href);

export async function publishDryRun(options: {
  cwd: string;
  extraPackages: ManyPkgPackage[];
}): Promise<void> {
  const packages = await getPackages(options.cwd);
  const config = await readConfig(packages);
  const npmCache = await fs.mkdtemp(path.join(tmpdir(), "expo-desktop-npm-cache-"));
  try {
    for (const pkg of [...packages.packages, ...options.extraPackages]) {
      if (
        pkg.packageJson.private ||
        shouldSkipPackage(pkg, {
          ignore: config.ignore,
          allowPrivatePackages: config.privatePackages.tag,
        })
      ) {
        continue;
      }
      await execFileAsync("npm", ["pack", "--dry-run", "--json"], {
        cwd: pkg.dir,
        encoding: "utf8",
        env: { ...process.env, npm_config_cache: npmCache },
        maxBuffer: 10 * 1024 * 1024,
      });
      log.success(`Dry run passed for ${pkg.packageJson.name}@${pkg.packageJson.version}`);
    }
  } finally {
    await fs.rm(npmCache, { force: true, recursive: true });
  }
}
