export function resolvePackageManagerOptions({
  noInstall,
  npm,
  yarn,
  bun,
  pnpm,
}: {
  noInstall: boolean | undefined;
  npm: boolean | undefined;
  yarn: boolean | undefined;
  bun: boolean | undefined;
  pnpm: boolean | undefined;
}) {
  const managers = {
    npm: !!npm,
    yarn: !!yarn,
    pnpm: !!pnpm,
    bun: !!bun,
  } as const satisfies Record<string, boolean>;

  if (
    [managers.npm, managers.pnpm, managers.yarn, managers.bun, !!noInstall].filter(Boolean).length >
    1
  ) {
    throw new Error("Specify at most one of: --no-install, --npm, --pnpm, --yarn, --bun");
  }

  for (const [manager, value] of Object.entries(managers)) {
    if (!value) {
      continue;
    }
    return manager as "npm" | "yarn" | "bun" | "pnpm";
  }
}
