import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import TestCasesModule from './TestCasesModule';
import {
  Project,
  TEST_RESULT_STATUSES,
  TestCaseResult,
  TestResultStatus,
  TestRun,
  TucanoApiClient,
} from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * True when a single case document was written. Reading a case back is allowed —
 * issue #65 only forbids storing an outcome there.
 */
function wroteCaseDocument(calls: readonly string[]): boolean {
  return calls.some((call) => /^(POST|PUT|PATCH|DELETE) .*\/api\/test_cases\//.test(call));
}

interface RecordedResult {
  testRunId: string;
  testCaseId: string;
  status: TestResultStatus;
}

interface StubApi {
  client: TucanoApiClient;
  calls: string[];
  identifiers: string[];
  /** Every result the board recorded, in order, through the run's own route. */
  recorded: RecordedResult[];
  /** The runs and the results they now hold, as the API would report them. */
  runs: Map<string, TestRun>;
  /**
   * Priority values that arrived looking like a result status. Issue #65: a
   * status must never be written into the case document, so this stays empty.
   */
  statusInPriority: { testCaseId: string; priority: string }[];
}

/** Routed stub: identifiers, case details, the run result route and the mutations. */
function createStubApi(
  initial: string[],
  options: {
    failDetail?: boolean;
    failMutation?: boolean;
    titles?: Record<string, string>;
    runs?: readonly TestRun[];
  } = {},
): StubApi {
  const identifiers = [...initial];
  const titles = new Map(initial.map((id) => [id, options.titles?.[id] ?? `Case ${id}`]));
  const calls: string[] = [];
  const recorded: RecordedResult[] = [];
  const statusInPriority: { testCaseId: string; priority: string }[] = [];
  const runs = new Map<string, TestRun>(
    (options.runs ?? []).map((entry): [string, TestRun] => [
      entry.testRunId,
      { ...entry, results: [...(entry.results ?? [])] },
    ]),
  );

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the board can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
    }

    // Results belong to a run, so this route is the only write path for a
    // status and it never touches a case document (issue #65).
    const result = /\/test_runs\/([^/]+)\/results$/.exec(urlStr);
    const resultRunId = result?.[1] ? decodeURIComponent(result[1]) : null;
    if (resultRunId) {
      const target = runs.get(resultRunId);
      if (method !== 'POST' || !target) {
        return json(
          { error: { code: 'not_found', message: `Test run ${resultRunId} could not be read` } },
          404,
        );
      }
      const body = JSON.parse(String(init?.body)) as {
        testCaseId: string;
        status: TestResultStatus;
      };
      recorded.push({
        testRunId: resultRunId,
        testCaseId: body.testCaseId,
        status: body.status,
      });
      // Results append, exactly as the API does, so the next read reflects them.
      target.results = [
        ...(target.results ?? []),
        { testCaseId: body.testCaseId, status: body.status },
      ];
      return json({ message: `Recorded ${body.status} for ${body.testCaseId}.` });
    }

    const detail = /\/test_cases\/([^/]+)$/.exec(urlStr);
    const detailId = detail?.[1] ? decodeURIComponent(detail[1]) : null;

    if (method === 'GET') {
      if (detailId) {
        if (options.failDetail || !identifiers.includes(detailId)) {
          return json(
            { error: { code: 'not_found', message: `Test case ${detailId} could not be read` } },
            404,
          );
        }
        return json({
          testCaseId: detailId,
          title: titles.get(detailId),
          expectedResult: `${detailId} expected result`,
          description: `${detailId} description`,
          priority: 'Medium',
          severity: 'Major',
          steps: ['Open the page'],
          attachments: [],
        });
      }
      return json(identifiers);
    }

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { testCaseId: string; title: string };
      identifiers.push(body.testCaseId);
      titles.set(body.testCaseId, body.title);
      return json({ id: body.testCaseId }, 201);
    }

    if (method === 'PUT' && detailId) {
      const body = JSON.parse(String(init?.body)) as { title: string; priority?: string };
      titles.set(detailId, body.title);
      // A priority that looks like an outcome is the regression issue #65 describes.
      if (body.priority && (TEST_RESULT_STATUSES as readonly string[]).includes(body.priority)) {
        statusInPriority.push({ testCaseId: detailId, priority: body.priority });
      }
      return json({ id: detailId });
    }

    if (method === 'DELETE' && detailId) {
      identifiers.splice(identifiers.indexOf(detailId), 1);
      return json({});
    }

    return json([]);
  }) as unknown as typeof fetch;

  return {
    client: new TucanoApiClient('/api', stubFetch),
    calls,
    identifiers,
    recorded,
    runs,
    statusInPriority,
  };
}

const RUN_ID = 'RUN-1.json';

/** A run the shell loaded; its embedded results are the only status source. */
function run(testRunId: string, results: TestCaseResult[] = []): TestRun {
  return { testRunId, timestamp: '2026-09-04T00:00:00Z', results };
}

const LOGIN_CASE_PROJECT: Project = {
  projectId: 'PROJ-1.json',
  name: 'Project One',
  testSuites: [
    {
      suiteId: 'SmokeTest.json',
      name: 'Smoke Test',
      testCases: [
        {
          testCaseId: 'TC-1.json',
          title: 'Verify Login',
          expectedResult: 'Dashboard displays',
        },
      ],
    },
  ],
};

/**
 * Stands in for the shell: it owns the filtered identifier list, triggers the
 * create form, re-lists on demand exactly as App does, and passes the runs the
 * board reads its results from.
 */
function ShellHarness({
  client,
  onStatus,
  initial = ['TC-1.json'],
  projects = [],
  suites = [],
  runs,
  onCreateSuite = vi.fn(),
  onCreateProject = vi.fn(),
  onCreateTestRun = vi.fn(),
}: {
  client: TucanoApiClient;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  initial?: string[];
  projects?: Project[];
  suites?: never[];
  runs?: readonly TestRun[];
  onCreateSuite?: () => void;
  onCreateProject?: () => void;
  onCreateTestRun?: () => void;
}) {
  const [identifiers, setIdentifiers] = useState<string[]>(initial);
  const [createRequest, setCreateRequest] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setCreateRequest((count) => count + 1)}>
        New case
      </button>
      <TestCasesModule
        client={client}
        identifiers={identifiers}
        projects={projects}
        suites={suites}
        runs={runs}
        createRequest={createRequest}
        onStatus={onStatus}
        onChanged={async () => setIdentifiers(await client.listTestCases())}
        onCreateSuite={onCreateSuite}
        onCreateProject={onCreateProject}
        onCreateTestRun={onCreateTestRun}
      />
    </>
  );
}

describe('TestCasesModule', () => {
  it('resolves the identifiers it is given into a folder board with a dense table', async () => {
    const api = createStubApi(['TC-1.json', 'Regression.json']);

    render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json', 'Regression.json']}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );

    // Pane 2 - both cases resolved through the client
    expect(await screen.findByRole('button', { name: 'Actions for Case TC-1.json' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Actions for Case Regression.json' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /^ID/ })).toBeDefined();
    expect(screen.getByRole('button', { name: '+ Create test case' })).toBeDefined();

    // Pane 1 - folder hierarchy
    expect(screen.getByRole('tree', { name: 'Test case folder hierarchy' })).toBeDefined();
    expect(screen.getByText('Test case folders')).toBeDefined();
  });

  it('shows a loading state until the details arrive, then only the board', async () => {
    const api = createStubApi(['TC-1.json']);

    render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json']}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );

    expect(screen.getByText('Fetching case details…')).toBeDefined();

    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });
    expect(screen.queryByText('Fetching case details…')).toBeNull();
  });

  it('renders an empty state when the filtered list has no cases', async () => {
    const api = createStubApi([]);

    render(
      <TestCasesModule
        client={api.client}
        identifiers={[]}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByText('No test cases to show.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Actions for / })).toBeNull();
  });

  it('surfaces the API error envelope when a case cannot be read', async () => {
    const api = createStubApi(['TC-1.json'], { failDetail: true });
    const onStatus = vi.fn();

    render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json']}
        projects={[]}
        suites={[]}
        onStatus={onStatus}
      />,
    );

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(
      screen.getByText(/could not load case details: test case TC-1\.json could not be read/i),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Actions for / })).toBeNull();
    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load case details: Test case TC-1.json could not be read',
        'error',
      ),
    );
  });

  it('filters the table when a folder is selected in the tree', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json'], { titles: { 'TC-1.json': 'Verify Login' } });

    render(
      <ShellHarness
        client={api.client}
        onStatus={vi.fn()}
        initial={['TC-1.json', 'TC-2.json']}
        projects={[LOGIN_CASE_PROJECT]}
      />,
    );

    // Unfiltered: both cases are listed, each in its own group.
    expect(await screen.findByRole('button', { name: 'Actions for Verify Login' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Actions for Case TC-2.json' })).toBeDefined();

    // Selecting the project narrows the table to the cases its suites own.
    fireEvent.click(screen.getByRole('treeitem', { name: /Project One/ }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Actions for Case TC-2.json' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Actions for Verify Login' })).toBeDefined();

    // The unfiled node holds the case no suite claims.
    fireEvent.click(screen.getByRole('treeitem', { name: /Test cases in no folder/ }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Actions for Verify Login' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Actions for Case TC-2.json' })).toBeDefined();
  });

  it('creates a case through the client, refreshes the board and announces it', async () => {
    const api = createStubApi([]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} initial={[]} />);
    await screen.findByText('No test cases to show.');

    fireEvent.click(screen.getByRole('button', { name: 'New case' }));
    expect(screen.getByRole('dialog', { name: /create new test case/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/test case id/i), { target: { value: 'TC-9' } });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Submit Order' } });
    fireEvent.change(screen.getByLabelText(/expected result/i), {
      target: { value: 'Order id generated' },
    });
    fireEvent.change(screen.getByLabelText(/step 1/i), { target: { value: 'Add item to cart' } });
    fireEvent.click(screen.getByRole('button', { name: /\+ add step/i }));
    fireEvent.change(screen.getByLabelText(/step 2/i), { target: { value: 'Check out' } });
    fireEvent.submit(screen.getByRole('button', { name: /save test case/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test case TC-9.json created successfully.'),
    );
    expect(screen.queryByRole('dialog', { name: /create new test case/i })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Actions for Submit Order' })).toBeDefined();
    expect(api.calls).toContain('POST /api/test_cases');
  });

  it('opens the create form from the folder tree menu', async () => {
    const api = createStubApi(['TC-1.json']);

    render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json']}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /new test case/i }));

    expect(screen.getByRole('dialog', { name: /create new test case/i })).toBeDefined();
  });

  it('edits a case and reports the new title', async () => {
    const api = createStubApi(['TC-1.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit TC-1.json' }));

    expect(screen.getByRole('dialog', { name: /edit test case: TC-1\.json/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Renamed Case' } });
    fireEvent.submit(screen.getByRole('button', { name: /update test case/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test case TC-1.json updated successfully.'),
    );
    expect(await screen.findByRole('button', { name: 'Actions for Renamed Case' })).toBeDefined();
    expect(api.calls).toContain('PUT /api/test_cases/TC-1.json');
    // The edit form writes a priority; it must not carry an outcome.
    expect(api.statusInPriority).toEqual([]);
  });

  it('requires an explicit confirmation before deleting a case', async () => {
    const api = createStubApi(['TC-1.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete TC-1.json' }));

    expect(screen.getByRole('dialog', { name: 'Confirm deletion of TC-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Test case TC-1.json deleted.'));
    expect(api.calls).toContain('DELETE /api/test_cases/TC-1.json');
    expect(await screen.findByText('No test cases to show.')).toBeDefined();
  });

  it('keeps the case when the deletion is cancelled', async () => {
    const api = createStubApi(['TC-1.json']);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete TC-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: /confirm deletion/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete TC-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('records a bulk outcome against the selected run, never on the cases', async () => {
    const selectedRun = run(RUN_ID);
    const api = createStubApi(['TC-1.json', 'TC-2.json'], { runs: [selectedRun] });
    const onStatus = vi.fn();

    render(
      <ShellHarness
        client={api.client}
        onStatus={onStatus}
        initial={['TC-1.json', 'TC-2.json']}
        runs={[selectedRun]}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    fireEvent.click(screen.getByLabelText('Select Case TC-1.json'));
    fireEvent.click(screen.getByLabelText('Select Case TC-2.json'));
    expect(screen.getByText('2 cases selected')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark passed' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(`Recorded Passed for 2 test cases in ${RUN_ID}.`),
    );
    expect(api.calls).toContain(`POST /api/test_runs/${RUN_ID}/results`);
    expect(api.recorded).toEqual([
      { testRunId: RUN_ID, testCaseId: 'TC-1.json', status: 'Passed' },
      { testRunId: RUN_ID, testCaseId: 'TC-2.json', status: 'Passed' },
    ]);
    // A status belongs to the run, so no case document is written (re-reads are
    // fine) and no status ever lands in a priority field.
    expect(wroteCaseDocument(api.calls)).toBe(false);
    expect(api.statusInPriority).toEqual([]);
    expect(api.runs.get(RUN_ID)?.results?.map((entry) => entry.status)).toEqual([
      'Passed',
      'Passed',
    ]);
    expect(screen.queryByText(/cases selected/)).toBeNull();
  });

  it('refuses to record without a run and points the reader at the run control', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json']);
    const onStatus = vi.fn();

    render(
      <ShellHarness
        client={api.client}
        onStatus={onStatus}
        initial={['TC-1.json', 'TC-2.json']}
        runs={[]}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    expect(screen.getByText('No test runs yet — create one to record results.')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Select Case TC-1.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark passed' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Select a test run before recording results.', 'error'),
    );
    expect(api.calls.some((call) => call.startsWith('POST'))).toBe(false);
  });

  it('shows the empty state and disables recording when the shell offers no runs', async () => {
    const api = createStubApi(['TC-1.json'], { titles: { 'TC-1.json': 'Verify Login' } });

    render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json']}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Verify Login' });

    // Without a run the board explains the cell instead of inventing a status.
    expect(screen.queryByLabelText('Results run')).toBeNull();
    expect(screen.getByText('No run selected')).toBeDefined();
    expect(
      (screen.getByLabelText('Record result for Verify Login') as HTMLSelectElement).disabled,
    ).toBe(true);
  });

  it('reads the LAST RESULT column from the run and records a row result through it', async () => {
    const seeded = run(RUN_ID, [{ testCaseId: 'TC-1.json', status: 'Failed' }]);
    const api = createStubApi(['TC-1.json'], {
      titles: { 'TC-1.json': 'Verify Login' },
      runs: [seeded],
    });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} runs={[seeded]} />);
    await screen.findByRole('button', { name: 'Actions for Verify Login' });

    // The status comes from the run's embedded results, not the case document.
    expect(screen.getByRole('status', { name: 'Status: Failed' })).toBeDefined();
    expect((screen.getByLabelText('Results run') as HTMLSelectElement).value).toBe(RUN_ID);

    fireEvent.change(screen.getByLabelText('Record result for Verify Login'), {
      target: { value: 'Passed' },
    });

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(`Recorded Passed for TC-1.json in ${RUN_ID}.`),
    );
    expect(api.calls).toContain(`POST /api/test_runs/${RUN_ID}/results`);
    expect(api.recorded).toEqual([
      { testRunId: RUN_ID, testCaseId: 'TC-1.json', status: 'Passed' },
    ]);
    // The API owns the history, so the new outcome is appended for the run.
    expect(api.runs.get(RUN_ID)?.results).toEqual([
      { testCaseId: 'TC-1.json', status: 'Failed' },
      { testCaseId: 'TC-1.json', status: 'Passed' },
    ]);
    expect(api.statusInPriority).toEqual([]);
  });

  it('deletes a whole selection only after confirmation', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json']);
    const onStatus = vi.fn();

    render(
      <ShellHarness client={api.client} onStatus={onStatus} initial={['TC-1.json', 'TC-2.json']} />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    fireEvent.click(screen.getByLabelText('Select Case TC-1.json'));
    fireEvent.click(screen.getByLabelText('Select Case TC-2.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    expect(
      screen.getByRole('group', { name: 'Confirm deletion of 2 cases' }),
    ).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Deleted 2 test cases.'));
    expect(api.calls).toContain('DELETE /api/test_cases/TC-1.json');
    expect(api.calls).toContain('DELETE /api/test_cases/TC-2.json');
    expect(await screen.findByText('No test cases to show.')).toBeDefined();
  });

  it('opens the detail pane and advances through the folder with Pass & next', async () => {
    const selectedRun = run(RUN_ID);
    const api = createStubApi(['TC-1.json', 'TC-2.json'], { runs: [selectedRun] });
    const onStatus = vi.fn();

    render(
      <ShellHarness
        client={api.client}
        onStatus={onStatus}
        initial={['TC-1.json', 'TC-2.json']}
        runs={[selectedRun]}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Case TC-1.json' }));
    await screen.findByRole('button', { name: 'Close detail panel' });
    expect(screen.getByText('ID: TC-1.json')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Steps & Description' })).toBeDefined();

    const previous = () =>
      screen.getByRole('button', { name: 'Previous test case' }) as HTMLButtonElement;
    const passAndNext = () =>
      screen.getByRole('button', { name: /pass & next/i }) as HTMLButtonElement;
    expect(previous().disabled).toBe(true);
    // With a run selected the outcome can be recorded; without one it is disabled.
    expect(passAndNext().disabled).toBe(false);

    fireEvent.click(passAndNext());

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(`Recorded Passed for TC-1.json in ${RUN_ID}.`),
    );
    expect(await screen.findByText('ID: TC-2.json')).toBeDefined();
    await waitFor(() => expect(previous().disabled).toBe(false));
    expect(api.calls).toContain(`POST /api/test_runs/${RUN_ID}/results`);
    // Pass & next records a result; it does not write the case document.
    expect(wroteCaseDocument(api.calls)).toBe(false);
    expect(api.statusInPriority).toEqual([]);
  });

  it('reports a refused mutation through the shared status region', async () => {
    const api = createStubApi(['TC-1.json'], { failMutation: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete TC-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not delete test case: Storage is read-only',
        'error',
      ),
    );
  });

  it('reports a refused result without losing the board', async () => {
    const selectedRun = run(RUN_ID);
    const api = createStubApi(['TC-1.json'], {
      failMutation: true,
      titles: { 'TC-1.json': 'Verify Login' },
      runs: [selectedRun],
    });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} runs={[selectedRun]} />);
    await screen.findByRole('button', { name: 'Actions for Verify Login' });

    fireEvent.change(screen.getByLabelText('Record result for Verify Login'), {
      target: { value: 'Blocked' },
    });

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not record a result for TC-1.json: Storage is read-only',
        'error',
      ),
    );
    expect(api.recorded).toEqual([]);
    expect(screen.getByRole('button', { name: 'Actions for Verify Login' })).toBeDefined();
  });

  it('has no detectable WCAG 2.1 AA violations on the board with the detail pane open', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json']);

    const { container } = render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json', 'TC-2.json']}
        projects={[LOGIN_CASE_PROJECT]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Case TC-1.json' }));
    await screen.findByRole('button', { name: 'Close detail panel' });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with a bulk selection confirmed', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json']);

    const { container } = render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json', 'TC-2.json']}
        projects={[]}
        suites={[]}
        onStatus={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });
    fireEvent.click(screen.getByLabelText('Select Case TC-1.json'));
    fireEvent.click(screen.getByLabelText('Select Case TC-2.json'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    expect(screen.getByRole('group', { name: 'Confirm deletion of 2 cases' })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the create form open', async () => {
    const api = createStubApi(['TC-1.json']);

    const { container } = render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json']}
        projects={[]}
        suites={[]}
        createRequest={1}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByRole('dialog', { name: /create new test case/i })).toBeDefined();
    // Let the detail load settle before auditing, so axe sees a stable tree.
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the run controls and recorded results', async () => {
    const selectedRun = run(RUN_ID, [
      { testCaseId: 'TC-1.json', status: 'Passed' },
      { testCaseId: 'TC-2.json', status: 'Blocked' },
    ]);
    const api = createStubApi(['TC-1.json', 'TC-2.json', 'TC-3.json'], {
      titles: { 'TC-1.json': 'Verify Login' },
      runs: [selectedRun],
    });

    const { container } = render(
      <TestCasesModule
        client={api.client}
        identifiers={['TC-1.json', 'TC-2.json', 'TC-3.json']}
        projects={[]}
        suites={[]}
        runs={[selectedRun]}
        onStatus={vi.fn()}
      />,
    );
    await screen.findByRole('button', { name: 'Actions for Verify Login' });

    // A recorded result, a run holding none for a case, and the run selector
    // all on screen at once.
    expect(screen.getByRole('status', { name: 'Status: Passed' })).toBeDefined();
    expect(screen.getAllByText('No result yet').length).toBe(1);
    expect(screen.getByLabelText('Results run')).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
