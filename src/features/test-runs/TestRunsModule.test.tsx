import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import TestRunsModule from './TestRunsModule';
import {
  DefectLink,
  DefectLinkInput,
  TestCasePriority,
  TestCaseResult,
  TestCase,
  TestRun,
  TestSuite,
  TestResultStatus,
  TucanoApiClient,
} from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function testCase(id: string, title: string, priority?: TestCasePriority): TestCase {
  return {
    testCaseId: id,
    title,
    expectedResult: `${title} behaves`,
    steps: ['Navigate to /login', 'Enter credentials'],
    priority,
  };
}

function run(
  id: string,
  testCases: TestCase[],
  options: { timestamp?: string; results?: TestCaseResult[] } = {},
): TestRun {
  return {
    testRunId: id,
    timestamp: options.timestamp ?? '2026-09-04T00:00:00Z',
    testCases,
    results: options.results,
  };
}

const SUITE: TestSuite = {
  suiteId: 'SmokeTest.json',
  name: 'Smoke Test',
  testCases: [testCase('TC-9.json', 'Suite case')],
};

interface RecordedResult {
  testRunId: string;
  testCaseId: string;
  status: TestResultStatus;
}

/** A defect write as the API receives it: scoped to a result, minus the identity. */
interface LinkedDefect extends DefectLinkInput {
  runId: string;
  caseId: string;
}

interface StubApi {
  client: TucanoApiClient;
  calls: string[];
  runs: Map<string, TestRun>;
  created: TestRun[];
  updated: TestRun[];
  recorded: RecordedResult[];
  defectLinks: Map<string, DefectLink[]>;
  linkedDefects: LinkedDefect[];
  unlinkedDefects: string[];
}

/** Defect links belong to one result of one run, which is how the stub keys them. */
function defectKey(runId: string, caseId: string): string {
  return `${runId}::${caseId}`;
}

/** Routed stub: the run list, run details, the result and defect routes, and the mutations. */
function createStubApi(
  initial: TestRun[],
  options: {
    failDetail?: boolean;
    failRetry?: boolean;
    failMutation?: boolean;
    defects?: DefectLink[];
  } = {},
): StubApi {
  const runs = new Map(initial.map((entity) => [entity.testRunId, entity]));
  const calls: string[] = [];
  const created: TestRun[] = [];
  const updated: TestRun[] = [];
  const recorded: RecordedResult[] = [];
  const defectLinks = new Map<string, DefectLink[]>();
  const linkedDefects: LinkedDefect[] = [];
  const unlinkedDefects: string[] = [];
  let detailReads = 0;
  // Seeded links belong to RUN-1.json/TC-1.json, the pair these tests exercise.
  if (options.defects) defectLinks.set(defectKey('RUN-1.json', 'TC-1.json'), options.defects);
  let defectSequence = options.defects?.length ?? 0;

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the module can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
    }

    // The result route owns its own path segment; match it before the detail route.
    const resultMatch = /\/test_runs\/([^/]+)\/results$/.exec(urlStr);
    const resultId = resultMatch?.[1] ? decodeURIComponent(resultMatch[1]) : null;
    if (resultId) {
      const target = runs.get(resultId);
      if (method !== 'POST' || !target) {
        return json(
          { error: { code: 'not_found', message: `Test run ${resultId} could not be read` } },
          404,
        );
      }
      const body = JSON.parse(String(init?.body)) as {
        testCaseId: string;
        status: TestResultStatus;
      };
      recorded.push({ testRunId: resultId, testCaseId: body.testCaseId, status: body.status });
      // Results append, exactly as the API does, so the next read reflects them.
      target.results = [
        ...(target.results ?? []),
        { testCaseId: body.testCaseId, status: body.status },
      ];
      return json({ message: `Recorded ${body.status} for ${body.testCaseId}.` });
    }

    // A defect link hangs off one result, so its own path is matched before the
    // greedy detail route, exactly as the API scopes it.
    const defectMatch = /\/test_runs\/([^/]+)\/results\/([^/]+)\/defects(?:\/([^/]+))?$/.exec(
      urlStr,
    );
    const defectRunId = defectMatch?.[1] ? decodeURIComponent(defectMatch[1]) : null;
    const defectCaseId = defectMatch?.[2] ? decodeURIComponent(defectMatch[2]) : null;
    const defectLinkId = defectMatch?.[3] ? decodeURIComponent(defectMatch[3]) : null;

    if (defectRunId && defectCaseId) {
      const key = defectKey(defectRunId, defectCaseId);
      const held = defectLinks.get(key) ?? [];

      if (method === 'GET' && !defectLinkId) {
        return json({ defects: held });
      }

      if (method === 'POST' && !defectLinkId) {
        const body = JSON.parse(String(init?.body)) as DefectLinkInput;
        linkedDefects.push({ runId: defectRunId, caseId: defectCaseId, ...body });
        defectSequence += 1;
        const linked: DefectLink = {
          linkId: `LINK-${defectSequence}`,
          linkedAt: '1757030400',
          ...body,
        };
        defectLinks.set(key, [...held, linked]);
        return json({ id: linked.linkId, message: 'Defect linked.' }, 201);
      }

      if (method === 'DELETE' && defectLinkId) {
        if (!held.some((link) => link.linkId === defectLinkId)) {
          return json({ error: { code: 'not_found', message: 'That link does not exist' } }, 404);
        }
        defectLinks.set(
          key,
          held.filter((link) => link.linkId !== defectLinkId),
        );
        unlinkedDefects.push(defectLinkId);
        return json({ message: 'Defect unlinked.' });
      }

      return json({ error: { code: 'invalid_request', message: 'Unsupported defect call' } }, 400);
    }

    const detail = /\/test_runs\/(.+)$/.exec(urlStr);
    const detailId = detail?.[1] ? decodeURIComponent(detail[1]) : null;

    if (method === 'GET') {
      if (detailId) {
        detailReads += 1;
        const found = runs.get(detailId);
        if (options.failDetail || (options.failRetry && detailReads > 1) || !found) {
          return json(
            { error: { code: 'not_found', message: `Test run ${detailId} could not be read` } },
            404,
          );
        }
        return json(found);
      }
      return json([...runs.keys()]);
    }

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as TestRun;
      created.push(body);
      runs.set(body.testRunId, body);
      return json({ id: body.testRunId }, 201);
    }

    if (method === 'PUT' && detailId) {
      const body = JSON.parse(String(init?.body)) as TestRun;
      updated.push(body);
      runs.set(detailId, body);
      return json({ id: detailId });
    }

    if (method === 'DELETE' && detailId) {
      runs.delete(detailId);
      return json({});
    }

    return json([]);
  }) as unknown as typeof fetch;

  return {
    client: new TucanoApiClient('/api', stubFetch),
    calls,
    runs,
    created,
    updated,
    recorded,
    defectLinks,
    linkedDefects,
    unlinkedDefects,
  };
}

/**
 * Stands in for the shell: it owns the filtered identifier list, triggers the
 * create form, and re-lists on demand exactly as App does.
 */
function ShellHarness({
  client,
  onStatus,
  suites = [],
  initial = ['RUN-1.json'],
}: {
  client: TucanoApiClient;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  suites?: TestSuite[];
  initial?: string[];
}) {
  const [identifiers, setIdentifiers] = useState<string[]>(initial);
  const [createRequest, setCreateRequest] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setCreateRequest((count) => count + 1)}>
        Create test run
      </button>
      <TestRunsModule
        client={client}
        identifiers={identifiers}
        suites={suites}
        createRequest={createRequest}
        onStatus={onStatus}
        onChanged={async () => setIdentifiers(await client.listTestRuns())}
      />
    </>
  );
}

describe('run-scoped results', () => {
  it('shows a recorded status without reading the case priority as one', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Critical')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Passed' }],
      }),
    ]);

    render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));

    expect(await screen.findByText('Case 1 of 1: Verify Login is Passed.')).toBeDefined();
    expect(screen.getByText('1 passed · 0 failed · 0 blocked · 0 untested · 0 retest')).toBeDefined();
  });

  it('renders an empty state for a case the run holds no result for', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'High')]),
    ]);

    render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));

    expect(await screen.findByText('Case 1 of 1: Verify Login is Untested.')).toBeDefined();
    expect(screen.getByText('No result yet')).toBeDefined();
    // The priority that is not a result must not be counted as one (issue #65).
    expect(screen.getByText('0 passed · 0 failed · 0 blocked · 1 untested · 0 retest')).toBeDefined();
  });
});

describe('TestRunsModule', () => {
  it('resolves the identifiers it is given into run cards', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Passed' }],
      }),
      run('RUN-2.json', [testCase('TC-2.json', 'Submit Order'), testCase('TC-3.json', 'Log out')]),
    ]);

    render(
      <TestRunsModule
        client={api.client}
        identifiers={['RUN-1.json', 'RUN-2.json']}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Execute RUN-1.json' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Execute RUN-/ }).length).toBe(2);
    expect(screen.getByText('▶️ RUN-1.json')).toBeDefined();
    expect(screen.getByText('1 case — 1 passed, 0 failed')).toBeDefined();
    expect(screen.getByText('2 cases — 0 passed, 0 failed')).toBeDefined();
  });

  it('shows a loading state until the details arrive, then only the cards', async () => {
    const api = createStubApi([run('RUN-1.json', [])]);

    render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />,
    );

    expect(screen.getByText('Fetching run details…')).toBeDefined();

    await screen.findByRole('button', { name: 'Execute RUN-1.json' });
    expect(screen.queryByText('Fetching run details…')).toBeNull();
  });

  it('renders an empty state when the filtered list has no runs', async () => {
    const api = createStubApi([]);

    render(<TestRunsModule client={api.client} identifiers={[]} onStatus={vi.fn()} />);

    expect(await screen.findByText('No test runs to show.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Execute / })).toBeNull();
  });

  it('surfaces the API error envelope when a run cannot be read', async () => {
    const api = createStubApi([run('RUN-1.json', [])], { failDetail: true });
    const onStatus = vi.fn();

    render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={onStatus} />,
    );

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(
      screen.getByText(/could not load test run details: test run RUN-1\.json could not be read/i),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Execute / })).toBeNull();
    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load test run details: Test run RUN-1.json could not be read',
        'error',
      ),
    );
  });

  it('creates an empty run when no suite is selected', async () => {
    const api = createStubApi([]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} initial={[]} />);
    await screen.findByText('No test runs to show.');

    fireEvent.click(screen.getByRole('button', { name: 'Create test run' }));
    expect(screen.getByRole('dialog', { name: /create new test run/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/run id \(filename\)/i), { target: { value: 'Sprint42' } });
    fireEvent.submit(screen.getByRole('button', { name: /save test run/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test run Sprint42.json created successfully.'),
    );
    expect(api.created[0]?.testRunId).toBe('Sprint42.json');
    expect(api.created[0]?.testCases).toEqual([]);
    expect(screen.queryByRole('dialog', { name: /create new test run/i })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Execute Sprint42.json' })).toBeDefined();
  });

  it('seeds a new run from the test cases of the selected suite', async () => {
    const api = createStubApi([]);
    const onStatus = vi.fn();

    render(
      <ShellHarness client={api.client} onStatus={onStatus} suites={[SUITE]} initial={[]} />,
    );
    await screen.findByText('No test runs to show.');

    fireEvent.click(screen.getByRole('button', { name: 'Create test run' }));
    fireEvent.change(screen.getByLabelText(/run id \(filename\)/i), { target: { value: 'Smoke-Run' } });
    fireEvent.change(screen.getByLabelText(/test suite \(case selection\)/i), {
      target: { value: 'SmokeTest.json' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /save test run/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test run Smoke-Run.json created successfully.'),
    );
    expect(api.created[0]?.testRunId).toBe('Smoke-Run.json');
    expect(api.created[0]?.testCases?.map((entity) => entity.testCaseId)).toEqual(['TC-9.json']);
  });

  it('edits the run timestamp and replaces the case selection with a suite', async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')])]);
    const onStatus = vi.fn();

    render(
      <ShellHarness client={api.client} onStatus={onStatus} suites={[SUITE]} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Edit RUN-1.json' }));

    expect(screen.getByRole('dialog', { name: /edit test run: RUN-1\.json/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/run timestamp/i), {
      target: { value: '2026-10-01T09:30' },
    });
    fireEvent.change(screen.getByLabelText(/test suite \(case selection\)/i), {
      target: { value: 'SmokeTest.json' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /update test run/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test run RUN-1.json updated successfully.'),
    );
    expect(api.calls).toContain('PUT /api/test_runs/RUN-1.json');
    expect(api.updated[0]?.testRunId).toBe('RUN-1.json');
    expect(api.updated[0]?.timestamp).toBe(new Date('2026-10-01T09:30').toISOString());
    expect(api.updated[0]?.testCases?.map((entity) => entity.testCaseId)).toEqual(['TC-9.json']);
  });

  it("keeps the run's cases when the edit leaves the suite unselected", async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')])]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} suites={[SUITE]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit RUN-1.json' }));
    fireEvent.submit(screen.getByRole('button', { name: /update test run/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test run RUN-1.json updated successfully.'),
    );
    expect(api.updated[0]?.testCases?.map((entity) => entity.testCaseId)).toEqual(['TC-1.json']);
    // An untouched timestamp field round-trips through the local form and back.
    expect(api.updated[0]?.timestamp).toBe('2026-09-04T00:00:00.000Z');
  });

  it('requires an explicit confirmation before deleting a run', async () => {
    const api = createStubApi([run('RUN-1.json', [])]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete RUN-1.json' }));

    expect(screen.getByRole('group', { name: 'Confirm deletion of RUN-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Test run RUN-1.json deleted.'));
    expect(api.calls).toContain('DELETE /api/test_runs/RUN-1.json');
    expect(await screen.findByText('No test runs to show.')).toBeDefined();
  });

  it('keeps the run when the deletion is cancelled', async () => {
    const api = createStubApi([run('RUN-1.json', [])]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete RUN-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: /confirm deletion/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete RUN-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('reports a refused mutation through the shared status region', async () => {
    const api = createStubApi([run('RUN-1.json', [])], { failMutation: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete RUN-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not delete test run: Storage is read-only',
        'error',
      ),
    );
  });

  it('reports a result the API refuses without losing the board', async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')])], {
      failMutation: true,
    });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Passed' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not record the result: Storage is read-only',
        'error',
      ),
    );
    expect(api.recorded).toEqual([]);
    expect(screen.getByText(/execution workspace: RUN-1\.json/i)).toBeDefined();
    expect(await screen.findByText('Case 1 of 1: Verify Login is Untested.')).toBeDefined();
  });

  it('previews the selected run in the pane the board otherwise occupies', async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')])]);

    render(<TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />);
    expect(screen.getByText(/select a run and choose execute/i)).toBeDefined();

    fireEvent.click(await screen.findByRole('button', { name: 'Details for RUN-1.json' }));

    expect(screen.getByRole('region', { name: 'Test run details preview' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Test run RUN-1.json' })).toBeDefined();
    expect(screen.getByText('Run ID:').closest('p')?.textContent).toBe('Run ID: RUN-1.json');
    expect(screen.getByText('Timestamp:').closest('p')?.textContent).toBe(
      'Timestamp: 2026-09-04T00:00:00Z',
    );
    expect(screen.getByText('Test cases:').closest('p')?.textContent).toBe('Test cases: 1');
    expect(screen.getByText('Included test cases (1)')).toBeDefined();
    expect(screen.getByText('Verify Login (TC-1.json)')).toBeDefined();

    // The board steps aside rather than stacking a second pane beside it.
    expect(screen.queryByText(/select a run and choose execute/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
    expect(screen.getByText(/select a run and choose execute/i)).toBeDefined();
  });

  it('opens the run edit form from the preview pane', async () => {
    const api = createStubApi([run('RUN-1.json', [])]);

    render(<TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Details for RUN-1.json' }));

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('dialog', { name: /edit test run: RUN-1\.json/i })).toBeDefined();
  });

  it('records each result through the run result route, not a whole-run update', async () => {
    const api = createStubApi([
      run('RUN-1.json', [
        testCase('TC-1.json', 'Verify Login'),
        testCase('TC-2.json', 'Submit Order'),
      ]),
    ]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));

    await screen.findByText(/execution workspace: RUN-1\.json/i);
    expect(await screen.findByText('Case 1 of 2: Verify Login is Untested.')).toBeDefined();
    expect(
      screen.getByText('0 passed · 0 failed · 0 blocked · 2 untested · 0 retest'),
    ).toBeDefined();
    expect(screen.getByText(/navigate to \/login/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Passed' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Recorded Passed for Verify Login in RUN-1.json.'),
    );
    expect(api.calls).toContain('POST /api/test_runs/RUN-1.json/results');
    expect(api.recorded).toEqual([
      { testRunId: 'RUN-1.json', testCaseId: 'TC-1.json', status: 'Passed' },
    ]);
    // A status is never written back onto the case document or onto a whole run.
    expect(api.updated).toEqual([]);
    expect(api.runs.get('RUN-1.json')?.testCases?.[0]?.priority).toBeUndefined();
    expect(await screen.findByText('Case 1 of 2: Verify Login is Passed.')).toBeDefined();
    expect(
      screen.getByText('1 passed · 0 failed · 0 blocked · 1 untested · 0 retest'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /next case/i }));
    expect(await screen.findByText('Case 2 of 2: Submit Order is Untested.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Blocked' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Recorded Blocked for Submit Order in RUN-1.json.'),
    );
    expect(api.recorded[1]).toEqual({
      testRunId: 'RUN-1.json',
      testCaseId: 'TC-2.json',
      status: 'Blocked',
    });
    // The earlier result survives the second write; nothing overwrote it.
    expect(api.runs.get('RUN-1.json')?.results).toEqual([
      { testCaseId: 'TC-1.json', status: 'Passed' },
      { testCaseId: 'TC-2.json', status: 'Blocked' },
    ]);
  });

  it('records a retest outcome alongside the other statuses', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Failed' }],
      }),
    ]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    expect(await screen.findByText('Case 1 of 1: Verify Login is Failed.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Retest' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Recorded Retest for Verify Login in RUN-1.json.'),
    );
    expect(api.recorded[0]?.status).toBe('Retest');
    expect(await screen.findByText('Case 1 of 1: Verify Login is Retest.')).toBeDefined();
    expect(
      screen.getByText('0 passed · 0 failed · 0 blocked · 0 untested · 1 retest'),
    ).toBeDefined();
  });

  it('records an untested outcome to reset a result', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Failed' }],
      }),
    ]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    expect(await screen.findByText('Case 1 of 1: Verify Login is Failed.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark Untested' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Recorded Untested for Verify Login in RUN-1.json.'),
    );
    expect(api.recorded[0]?.status).toBe('Untested');
    // A reset is recorded, not erased: the API still owns the history.
    expect(api.runs.get('RUN-1.json')?.results).toEqual([
      { testCaseId: 'TC-1.json', status: 'Failed' },
      { testCaseId: 'TC-1.json', status: 'Untested' },
    ]);
    expect(await screen.findByText('Case 1 of 1: Verify Login is Untested.')).toBeDefined();
    // The reset is a recorded result of its own, not a return to the empty state.
    expect(screen.getByText('0 passed · 0 failed · 0 blocked · 1 untested · 0 retest')).toBeDefined();
    expect(screen.queryByText('No result yet')).toBeNull();
  });

  it('bounds the previous and next navigation to the run', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login'), testCase('TC-2.json', 'Submit Order')]),
    ]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    await screen.findByText('Case 1 of 2: Verify Login is Untested.');

    const previous = screen.getByRole('button', { name: /previous case/i }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: /next case/i }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    fireEvent.click(next);

    await screen.findByText('Case 2 of 2: Submit Order is Untested.');
    expect((screen.getByRole('button', { name: /previous case/i }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /next case/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('announces that a run holds no cases and closes the board on request', async () => {
    const api = createStubApi([run('Empty-Run.json', [])]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} initial={['Empty-Run.json']} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute Empty-Run.json' }));

    expect(await screen.findByText('No test cases in this run to execute.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark Passed' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /close execution/i }));
    expect(screen.queryByText(/execution workspace: Empty-Run\.json/i)).toBeNull();
    expect(screen.getByText(/select a run and choose execute/i)).toBeDefined();
  });

  it('reports a run it cannot start without losing the list', async () => {
    const api = createStubApi([run('RUN-1.json', [])], { failRetry: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not start test run: Test run RUN-1.json could not be read',
        'error',
      ),
    );
    // The list came from the first read and stays usable.
    expect(screen.getByRole('button', { name: 'Delete RUN-1.json' })).toBeDefined();
    expect(screen.queryByText(/execution workspace/i)).toBeNull();
  });

  it('offers defect links only for a failed or blocked result', async () => {
    const api = createStubApi([
      run(
        'RUN-1.json',
        [testCase('TC-1.json', 'Verify Login'), testCase('TC-2.json', 'Submit Order')],
        {
          results: [
            { testCaseId: 'TC-1.json', status: 'Failed' },
            { testCaseId: 'TC-2.json', status: 'Passed' },
          ],
        },
      ),
    ]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));

    expect(await screen.findByText('Case 1 of 2: Verify Login is Failed.')).toBeDefined();
    expect(await screen.findByText('No defects linked to this result.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Linked defects (0)' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /next case/i }));

    // A pass raises no defect, so the panel steps aside with the status.
    expect(await screen.findByText('Case 2 of 2: Submit Order is Passed.')).toBeDefined();
    expect(screen.queryByRole('heading', { name: /linked defects/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link defect' })).toBeNull();
  });

  it('links a defect to the failed result the board is showing', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Failed' }],
      }),
    ]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    await screen.findByText('Case 1 of 1: Verify Login is Failed.');
    await screen.findByText('No defects linked to this result.');

    fireEvent.change(screen.getByLabelText('Defect ID'), { target: { value: 'PROJ-42' } });
    fireEvent.change(screen.getByLabelText('Defect URL'), {
      target: { value: 'https://acme.atlassian.net/browse/PROJ-42' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Link defect' }).closest('form')!);

    await waitFor(() =>
      expect(api.linkedDefects).toEqual([
        {
          runId: 'RUN-1.json',
          caseId: 'TC-1.json',
          defectId: 'PROJ-42',
          defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
          trackerType: 'jira',
        },
      ]),
    );
    // The link is shown because the API holds it, not because the form said so.
    expect(await screen.findByText('Linked defects (1)')).toBeDefined();
    expect(await screen.findByRole('link', { name: 'PROJ-42' })).toBeDefined();
    expect(onStatus).toHaveBeenCalledWith('Linked defect PROJ-42 to TC-1.json in RUN-1.json.');
  });

  it('unlinks a defect from a blocked result and re-reads the API list', async () => {
    const api = createStubApi(
      [
        run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
          results: [{ testCaseId: 'TC-1.json', status: 'Blocked' }],
        }),
      ],
      {
        defects: [
          {
            linkId: 'LINK-1',
            defectId: 'PROJ-42',
            defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
            trackerType: 'jira',
            title: 'Login rejects a valid user',
            linkedAt: '1757030400',
          },
        ],
      },
    );
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    expect(await screen.findByText('Case 1 of 1: Verify Login is Blocked.')).toBeDefined();
    await screen.findByRole('link', { name: 'Login rejects a valid user' });

    fireEvent.click(screen.getByRole('button', { name: 'Unlink defect PROJ-42' }));

    await waitFor(() => expect(api.unlinkedDefects).toEqual(['LINK-1']));
    expect(await screen.findByText('No defects linked to this result.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Login rejects a valid user' })).toBeNull();
    expect(onStatus).toHaveBeenCalledWith('Unlinked defect PROJ-42 from TC-1.json in RUN-1.json.');
  });

  it('has no detectable WCAG 2.1 AA violations, including the delete confirmation', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
        results: [{ testCaseId: 'TC-1.json', status: 'Passed' }],
      }),
      run('RUN-2.json', []),
    ]);

    const { container } = render(
      <TestRunsModule
        client={api.client}
        identifiers={['RUN-1.json', 'RUN-2.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete RUN-1.json' }));
    expect(screen.getByRole('group', { name: 'Confirm deletion of RUN-1.json' })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the create form open', async () => {
    const api = createStubApi([run('RUN-1.json', [])]);

    const { container } = render(
      <TestRunsModule
        client={api.client}
        identifiers={['RUN-1.json']}
        suites={[SUITE]}
        createRequest={1}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByRole('dialog', { name: /create new test run/i })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations on the execution board', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login'), testCase('TC-2.json', 'Submit Order')]),
      run('Empty-Run.json', []),
    ]);

    const { container } = render(
      <TestRunsModule
        client={api.client}
        identifiers={['RUN-1.json', 'Empty-Run.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    await screen.findByText('Case 1 of 2: Verify Login is Untested.');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations once a result is recorded', async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')])]);

    const { container } = render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Passed' }));
    expect(await screen.findByText('Case 1 of 1: Verify Login is Passed.')).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the defect links open', async () => {
    const api = createStubApi(
      [
        run('RUN-1.json', [testCase('TC-1.json', 'Verify Login')], {
          results: [{ testCaseId: 'TC-1.json', status: 'Failed' }],
        }),
      ],
      {
        defects: [
          {
            linkId: 'LINK-1',
            defectId: 'PROJ-42',
            defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
            trackerType: 'jira',
            title: 'Login rejects a valid user',
            linkedAt: '1757030400',
          },
        ],
      },
    );

    const { container } = render(
      <TestRunsModule client={api.client} identifiers={['RUN-1.json']} onStatus={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    await screen.findByRole('link', { name: 'Login rejects a valid user' });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
