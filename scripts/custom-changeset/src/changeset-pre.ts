// A light fork of @changesets/cli@3.0.1's pre command.
//
// Every behavioral difference from upstream is enclosed in a FORK block.
// Source: https://github.com/changesets/changesets/blob/bed458124f623463c581521ab56d040eba2a8b20/packages/cli/src/commands/pre/index.ts

// FORK (start 1)
import type { Package as ManyPkgPackage } from "@manypkg/tools";
// FORK (end 1)

import {
  ExitError,
  PreEnterButInPreModeError,
  PreExitButNotInPreModeError,
} from "@changesets/errors";
import { enterPre, exitPre } from "@changesets/pre";
import { log } from "@clack/prompts";
import { getPackages } from "@manypkg/get-packages";

// FORK (start 2)
import { disambiguatePackages } from "./package-identities.ts";
// FORK (end 2)

const cliPackageJsonUrl = import.meta.resolve("@changesets/cli/package.json");

const {
  t: ensureChangesetFolder,
}: {
  t(rootDir: string): Promise<void>;
} = await import(new URL("./dist/shared.mjs", cliPackageJsonUrl).href);

const {
  t: src_default,
}: {
  t: ColorProxy;
} = await import(new URL("./dist/src.mjs", cliPackageJsonUrl).href);
type Color = Extract<Parameters<typeof import("node:util").styleText>[0], string>;
type ColorProxy = Record<Color, (text: string) => string>;

export type PreOptions = {
  cwd?: string;
  // FORK (start 3)
  /** Packages intentionally excluded from the monorepo workspace config. */
  extraPackages?: ManyPkgPackage[];
  // FORK (end 3)
} & ({ command: "enter"; tag: string } | { command: "exit"; tag?: never });

export async function pre(options: PreOptions): Promise<void> {
  // FORK (start 4)
  const discoveredPackages = await getPackages(options.cwd ?? process.cwd());
  discoveredPackages.packages.push(...(options.extraPackages ?? []));

  // Pre state itself contains only the mode and tag in Changesets 3, but run
  // the complete package set through the same tuple-identity validation used
  // by add, version, and publish before writing that state.
  const { packages } = disambiguatePackages(discoveredPackages);
  // FORK (end 4)
  await ensureChangesetFolder(packages.rootDir);
  if (options.command === "enter")
    try {
      await enterPre(packages.rootDir, options.tag);
      log.success(
        `
Entered pre mode with tag ${src_default.green(options.tag)}!
Run ${src_default.cyan("changeset version")} to version packages with prerelease versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreEnterButInPreModeError) {
        log.error(
          `
${src_default.cyan("changeset pre enter")} cannot be run when in pre mode.
If you're trying to exit pre mode, run ${src_default.cyan("changeset pre exit")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
  else
    try {
      await exitPre(packages.rootDir);
      log.success(
        `
Exited pre mode!
Run ${src_default.cyan("changeset version")} to version packages with normal versions.
        `.trim(),
      );
    } catch (err) {
      if (err instanceof PreExitButNotInPreModeError) {
        log.error(
          `
${src_default.cyan("changeset pre exit")} can only be run when in pre mode!
If you're trying to enter pre mode, run ${src_default.cyan("changeset pre enter")}.
          `.trim(),
        );
        throw new ExitError(1);
      }
      throw err;
    }
}
