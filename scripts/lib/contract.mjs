// Shared helpers for the pinned API contract. The vendored `api/openapi.json` is
// the single source of truth the generated client is built from, so its provenance
// is recorded in `api/contract.lock.json` and verified before every generation.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const CONTRACT_PATH = path.join(REPO_ROOT, 'api', 'openapi.json');
export const LOCK_PATH = path.join(REPO_ROOT, 'api', 'contract.lock.json');
export const GENERATED_DIR = path.join(REPO_ROOT, 'src', 'api', 'generated');

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function readLock() {
  return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
}

export function countOperations(spec) {
  return Object.values(spec.paths ?? {}).reduce(
    (total, pathItem) =>
      total +
      Object.keys(pathItem).filter((key) => key !== 'parameters' && key !== 'summary').length,
    0,
  );
}

/**
 * Reads the vendored contract and fails when it no longer matches the pinned
 * lockfile, which means someone edited the spec instead of running
 * `npm run sync:openapi`.
 */
export function verifyContract() {
  const lock = readLock();
  const raw = readFileSync(CONTRACT_PATH);
  const digest = sha256(raw);

  if (digest !== lock.sha256) {
    throw new Error(
      [
        `api/openapi.json does not match the pinned contract.`,
        `  expected sha256 ${lock.sha256}`,
        `  actual   sha256 ${digest}`,
        `Run \`npm run sync:openapi\` to refresh both the spec and the lockfile.`,
      ].join('\n'),
    );
  }

  const spec = JSON.parse(raw.toString('utf8'));
  const operations = countOperations(spec);

  if (spec.openapi !== lock.openapi) {
    throw new Error(
      `api/openapi.json declares OpenAPI ${spec.openapi} but the lockfile pins ${lock.openapi}.`,
    );
  }

  if (operations !== lock.operationCount) {
    throw new Error(
      `api/openapi.json exposes ${operations} operations but the lockfile pins ${lock.operationCount}.`,
    );
  }

  return { lock, spec, digest };
}
