// Refreshes the vendored `api/openapi.json` from the upstream TucanoTestAPI
// repository and rewrites `api/contract.lock.json` to pin the new revision.
//
//   npm run sync:openapi                 # re-reads the pinned ref
//   npm run sync:openapi -- --ref <sha>  # moves the pin forward
//
// Requires the GitHub CLI to be authenticated with read access to TucanoTestAPI.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';

import {
  CONTRACT_PATH,
  LOCK_PATH,
  REPO_ROOT,
  countOperations,
  readLock,
  sha256,
} from './lib/contract.mjs';

function parseRefArg(argv) {
  const index = argv.indexOf('--ref');
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value) throw new Error('--ref requires a value');
  return value;
}

/** Escapes a value for use inside an `api` endpoint template expression. */
function escapeForEndpoint(value) {
  return value.replace(/[{/]/g, (char) => `{{${char}}}`);
}

function fetchSpec(repository, path, ref) {
  const endpoint = `repos/${repository}/contents/${escapeForEndpoint(path)}${
    ref ? `?ref=${encodeURIComponent(ref)}` : ''
  }`;
  const response = JSON.parse(
    execFileSync('gh', ['api', endpoint, '--jq', '{content: .content, sha: .sha}'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
  return {
    content: Buffer.from(response.content, 'base64'),
    blobSha: response.sha,
  };
}

const current = readLock();
const requestedRef = parseRefArg(process.argv.slice(2));
const ref = requestedRef ?? current.ref;

if (!ref) {
  throw new Error(
    'No revision pinned. Pass one explicitly: npm run sync:openapi -- --ref <sha>',
  );
}

const { content, blobSha } = fetchSpec(current.repository, current.path, ref);

let spec;
try {
  spec = JSON.parse(content.toString('utf8'));
} catch (error) {
  throw new Error(`Upstream ${current.path} at ${ref} is not valid JSON: ${error.message}`);
}

const nextLock = {
  ...current,
  ref,
  sha256: sha256(content),
  openapi: spec.openapi ?? current.openapi,
  operationCount: countOperations(spec),
};

writeFileSync(CONTRACT_PATH, content);
writeFileSync(LOCK_PATH, `${JSON.stringify(nextLock, null, 2)}\n`);

console.log(
  [
    `Synced ${relative(REPO_ROOT, CONTRACT_PATH)} from ${current.repository}@${ref.slice(0, 12)}`,
    `  blob    ${blobSha}`,
    `  sha256  ${nextLock.sha256}`,
    `  openapi ${nextLock.openapi} (${nextLock.operationCount} operations)`,
    '',
    'Next: commit api/openapi.json + api/contract.lock.json, then run `npm run generate:client`.',
  ].join('\n'),
);
