import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { argv, cwd, exit } from 'node:process';

import createExpoPackageJson from 'create-expo/package.json' with { type: 'json' };

const require = createRequire(import.meta.url);

export function spawnCreateExpo(args: ReadonlyArray<string>) {
  const createExpo = path.resolve(
    path.dirname(require.resolve('create-expo/package.json')),
    (createExpoPackageJson as { main: string }).main
  );
  const child = spawn(argv[0], [createExpo, ...args], {
    cwd: cwd(),
    stdio: 'inherit',
  });
  child.on('close', (code) => {
    exit(code ?? 1);
  });
}
