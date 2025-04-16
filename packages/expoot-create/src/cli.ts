import { argv, exit } from 'node:process';
import { parseArgs } from 'node:util';

import chalk from 'chalk';
import createExpoPackageJson from 'create-expo/package.json' with { type: 'json' };

import expootPackageJson from '../package.json' with { type: 'json' };

import { spawnCreateExpo } from './spawn-create-expo.ts';

await main();

async function main() {
  const args = parseArgs({
    args: argv.slice(2),
    options: {
      yes: {
        type: 'boolean',
        short: 'y',
      },
      'no-install': {
        type: 'boolean',
      },
      version: {
        type: 'boolean',
        short: 'v',
      },
      help: {
        type: 'boolean',
        short: 'h',
      },
      template: { type: 'string', short: 't' },
      example: { type: 'string', short: 'e' },
    },
    allowPositionals: true,
    // This makes all behave as either boolean or string, allowing both
    // `--device` as boolean and `--device` as string. Unfortunately forfeits
    // the free validation of correct usage of flags.
    //
    // TODO: use strict parsing for all args except the hybrid ones.
    strict: false,
  });

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    values: { version, help, 'no-install': noInstall, template, example },
    positionals,
  } = args;

  if (version) {
    console.log(
      `@expoot/create: ${(expootPackageJson as { version: string }).version}`
    );
    console.log(
      ` create-expoot: ${(createExpoPackageJson as { version: string }).version}`
    );
    return;
  }

  if (help) {
    // TODO: finish the description
    console.log(chalk`
      Creates a new Expo project (with out-of-tree platform support via Expoot)
      {bold Usage}
        {dim $} npx create-expoot <command>
      {bold Options}
        -y, --yes             Use the default options for creating a project
            --no-install      Skip installing npm packages or CocoaPods
        -t, --template {gray [pkg]}  NPM template to use: default, blank, blank-typescript, tabs, bare-minimum. Default: default
        -e, --example {gray [name]}  Example name from {underline https://github.com/expo/examples}.
        -v, --version   Version number
        -h, --help      Usage info
    `);
    exit(0);
  }

  // TODO: fork the bits to support Windows, based on this PR:
  // https://github.com/expo/expo/pull/30309
  spawnCreateExpo(positionals);
}
