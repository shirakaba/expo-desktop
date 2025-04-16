#!/usr/bin/env node

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { argv, cwd, env, stderr, exit } from 'node:process';

const __dirname = import.meta.dirname;
const pathToCli = path.join(__dirname, 'src/cli.ts');
const [executable, _file, ...rest] = argv;

const child = spawn(
  executable,
  [
    '--experimental-strip-types',
    '--experimental-require-module',
    pathToCli,
    ...rest,
  ],
  {
    cwd: cwd(),
    stdio: ['inherit', 'inherit', 'pipe'],
    // Ensure we don't lose colour in stderr. But if the user passed FORCE_COLOR
    // themselves for some reason, then respect it.
    env: { ...env, FORCE_COLOR: env.FORCE_COLOR ?? '1' },
  }
);

// Suppress certain ExperimentalWarnings.
child.stderr.on(
  'data',
  /** @param {Buffer} data */
  (data) => {
    // Both of these got unflagged in Node.js v23.
    if (
      data.toString().includes('ExperimentalWarning: Type Stripping') ||
      data.toString().includes('ExperimentalWarning: Importing JSON modules') ||
      data
        .toString()
        .includes(
          'ExperimentalWarning: Support for loading ES Module in require()'
        )
    ) {
      return;
    }

    stderr.write(data);
  }
);

child.on('close', (code) => {
  exit(code ?? 1);
});
