// Regenerates `src/api/generated` from the pinned contract. The output is
// committed, and CI re-runs this script to prove the committed client is not
// stale — never hand-edit anything under `src/api/generated`.
//
// The generator is driven through its CLI rather than its programmatic API:
// when the package is imported into an ESM process its Handlebars templates
// resolve to empty strings and every file is written as blank lines.

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative } from 'node:path';

import { CONTRACT_PATH, GENERATED_DIR, REPO_ROOT, verifyContract } from './lib/contract.mjs';

const { lock, spec } = verifyContract();

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('openapi-typescript-codegen/package.json');
const { version } = require(packageJsonPath);

if (version !== lock.generator.version) {
  throw new Error(
    `openapi-typescript-codegen ${version} is installed but the lockfile pins ` +
      `${lock.generator.version}. Update both together.`,
  );
}

const generatorBin = require.resolve('openapi-typescript-codegen/bin/index.js');

rmSync(GENERATED_DIR, { recursive: true, force: true });

execFileSync(
  process.execPath,
  [
    generatorBin,
    '--input',
    CONTRACT_PATH,
    '--output',
    GENERATED_DIR,
    '--client',
    'fetch',
    '--name',
    'TucanoApi',
    '--useOptions',
    '--useUnionTypes',
    '--exportSchemas',
    'false',
    '--indent',
    '2',
  ],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);

console.log(
  `Generated ${lock.operationCount} operations across ${Object.keys(spec.paths ?? {}).length} paths ` +
    `into ${relative(REPO_ROOT, GENERATED_DIR)} ` +
    `(${lock.repository}@${lock.ref.slice(0, 12)}, OpenAPI ${lock.openapi}).`,
);
