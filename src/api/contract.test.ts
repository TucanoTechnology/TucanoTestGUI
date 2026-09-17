import { describe, expect, it } from 'vitest';
import lockJson from '../../api/contract.lock.json?raw';
import specJson from '../../api/openapi.json?raw';
import { createApiClient } from './configure';
import { TucanoApi } from './generated';

interface OpenApiOperation {
  operationId?: string;
}

interface OpenApiSpec {
  openapi: string;
  paths: Record<string, Record<string, OpenApiOperation>>;
}

const spec = JSON.parse(specJson) as OpenApiSpec;

const lock = JSON.parse(lockJson) as { openapi: string; operationCount: number };

/**
 * The operationIds issue #54 requires the generated client to expose, grouped
 * as the ticket groups them. Two entries are no longer in the contract at all;
 * see RETIRED_GLOBAL_COLLECTIONS.
 */
const REQUIRED_OPERATIONS: Record<string, string[]> = {
  auth: ['login', 'logout', 'getCurrentUser', 'refreshSession'],
  configurations: [
    'listConfigurations',
    'createConfiguration',
    'getConfiguration',
    'updateConfiguration',
    'deleteConfiguration',
  ],
  reports: ['getCoverageReport', 'getSummaryReport'],
  duplicates: [
    'duplicateProject',
    'duplicateTestSuite',
    'duplicateTestCase',
    'duplicateTestRun',
    'duplicateMilestone',
  ],
  'results/defects': [
    'recordTestRunResult',
    'listResultDefects',
    'linkResultDefect',
    'unlinkResultDefect',
  ],
  history: ['listTestCaseHistory', 'getTestCaseVersion'],
  importers: ['importJsonResults', 'importJUnitResults'],
  'step attachments': ['listStepAttachments', 'uploadStepAttachment', 'deleteStepAttachment'],
};

/**
 * Operations #54 lists that the published contract deliberately does not
 * define, mapped to the published operation that replaced each one.
 *
 * TucanoTestAPI kept the global collection routes served — reads are global by
 * design — but removed them from `openapi.json` together with the global
 * creates, the same treatment `GET /test_suites` and `GET /test_cases` already
 * had (TucanoTestAPI#222; `api::UNDOCUMENTED_ROUTES` in that repository's
 * `src/api/mod.rs`). `openapi.json` is the contract, so the generator cannot
 * emit them.
 *
 * Both halves of that decision are asserted below: the retired operations must
 * stay absent from the document, and their replacements must stay in it. If
 * either side moves, these tests fail and this table has to be revisited.
 */
const RETIRED_GLOBAL_COLLECTIONS: Record<string, string> = {
  listConfigurations: 'listProjectConfigurations',
  createConfiguration: 'addProjectConfiguration',
};

const retiredOperationIds = Object.keys(RETIRED_GLOBAL_COLLECTIONS);

const specOperationIds = new Set(
  Object.values(spec.paths).flatMap((pathItem) =>
    Object.entries(pathItem)
      .filter(([method]) => method !== 'parameters' && method !== 'summary')
      .map(([, operation]) => operation.operationId),
  ),
);

/** The documented path each operationId sits at. */
const specOperationPaths = new Map<string, string>();
for (const [path, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (method === 'parameters' || method === 'summary') continue;
    if (operation.operationId) specOperationPaths.set(operation.operationId, path);
  }
}

const requiredOperationIds = Object.values(REQUIRED_OPERATIONS).flat();
const publishedRequiredOperationIds = requiredOperationIds.filter(
  (id) => !retiredOperationIds.includes(id),
);

/** Method names every generated service offers, ignoring `constructor`. */
function generatedOperationIds(client: TucanoApi): Set<string> {
  const names = new Set<string>();
  for (const value of Object.values(client)) {
    if (value === null || typeof value !== 'object') continue;
    if (!value.constructor.name.endsWith('Service')) continue;
    for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(value))) {
      if (name !== 'constructor') names.add(name);
    }
  }
  return names;
}

describe('vendored contract', () => {
  it('matches the pinned lockfile', () => {
    expect(spec.openapi).toBe(lock.openapi);
    expect(specOperationIds.size).toBe(lock.operationCount);
  });

  it('gives every operation an operationId', () => {
    expect([...specOperationIds].filter((id) => !id)).toEqual([]);
  });

  it('declares every required operation that the contract publishes', () => {
    expect(publishedRequiredOperationIds.filter((id) => !specOperationIds.has(id))).toEqual([]);
  });

  it('does not publish the retired global collection routes', () => {
    expect(retiredOperationIds.filter((id) => specOperationIds.has(id))).toEqual([]);
  });

  it('publishes a replacement for every retired operation', () => {
    expect(
      Object.entries(RETIRED_GLOBAL_COLLECTIONS)
        .filter(([, replacement]) => !specOperationIds.has(replacement))
        .map(([retired, replacement]) => `${retired} → ${replacement}`),
    ).toEqual([]);
  });

  it('retires only operations that the ticket listed', () => {
    expect(retiredOperationIds.filter((id) => !requiredOperationIds.includes(id))).toEqual([]);
  });

  it('reaches configurations through a parent-scoped route', () => {
    const notParentScoped = Object.entries(RETIRED_GLOBAL_COLLECTIONS)
      .map(([retired, replacement]) => [retired, replacement, specOperationPaths.get(replacement)] as const)
      .filter(([, , path]) => !path?.startsWith('/projects/{id}/'))
      .map(([retired, replacement, path]) => `${retired} → ${replacement} at ${String(path)}`);
    expect(notParentScoped).toEqual([]);
  });
});

describe('generated client', () => {
  const client = createApiClient();
  const generated = generatedOperationIds(client);

  it('exposes a service group per API tag', () => {
    expect(generated.size).toBeGreaterThan(0);
    expect(client.request).toBeDefined();
  });

  it('exposes every required operation that the contract publishes', () => {
    expect(publishedRequiredOperationIds.filter((id) => !generated.has(id))).toEqual([]);
  });

  it('generates exactly the operations the contract declares', () => {
    expect([...specOperationIds].filter((id) => id && !generated.has(id))).toEqual([]);
  });

  it('exposes the replacement for every retired operation', () => {
    expect(
      Object.entries(RETIRED_GLOBAL_COLLECTIONS)
        .filter(([, replacement]) => !generated.has(replacement))
        .map(([retired, replacement]) => `${retired} → ${replacement}`),
    ).toEqual([]);
  });

  it('does not expose the retired global collection operations', () => {
    expect(retiredOperationIds.filter((id) => generated.has(id))).toEqual([]);
  });
});
