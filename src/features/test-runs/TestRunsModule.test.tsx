import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import TestRunsModule, { applyResult, resultFromCase } from './TestRunsModule';
import { TestCase, TestRun, TestSuite, TucanoApiClient } from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function testCase(id: string, title: string, priority?: string): TestCase {
  return {
    testCaseId: id,
    title,
    expectedResult: `${title} behaves`,
    steps: ['Navigate to /login', 'Enter credentials'],
    priority,
  };
}

function run(id: string, testCases: TestCase[], timestamp = '2026-09-04T00:00:00Z'): TestRun {
  return { testRunId: id, timestamp, testCases };
}

const SUITE: TestSuite = {
  suiteId: 'SmokeTest.json',
  name: 'Smoke Test',
  testCases: [testCase('TC-9.json', 'Suite case')],
};

interface StubApi {
  client: TucanoApiClient;
  calls: string[];
  runs: Map<string, TestRun>;
  created: TestRun[];
  updated: TestRun[];
}

/** Routed stub: the run list, run details, and the three mutations. */
function createStubApi(
  initial: TestRun[],
  options: { failDetail?: boolean; failRetry?: boolean; failMutation?: boolean } = {},
): StubApi {
  const runs = new Map(initial.map((entity) => [entity.testRunId, entity]));
  const calls: string[] = [];
  const created: TestRun[] = [];
  const updated: TestRun[] = [];
  let detailReads = 0;

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the module can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
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

  return { client: new TucanoApiClient('/api', stubFetch), calls, runs, created, updated };
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

describe('run-scoped result mapping', () => {
  it('reads a recorded result back off the case', () => {
    expect(resultFromCase(testCase('TC-1.json', 'Verify Login', 'Passed'))).toBe('Passed');
    expect(resultFromCase(testCase('TC-2.json', 'Verify Login', 'Failed'))).toBe('Failed');
    expect(resultFromCase(testCase('TC-3.json', 'Verify Login', 'Blocked'))).toBe('Blocked');
  });

  it('treats an unrecorded case as untested', () => {
    expect(resultFromCase(testCase('TC-1.json', 'Verify Login'))).toBe('Untested');
    // Case priority is a separate concern (issue #65): a priority that is not a
    // result must not be mistaken for one.
    expect(resultFromCase(testCase('TC-1.json', 'Verify Login', 'High'))).toBe('Untested');
  });

  it('records a result without mutating the case it came from', () => {
    const original = testCase('TC-1.json', 'Verify Login', 'High');
    const recorded = applyResult(original, 'Passed');

    expect(recorded.priority).toBe('Passed');
    expect(recorded.title).toBe('Verify Login');
    expect(original.priority).toBe('High');
  });
});

describe('TestRunsModule', () => {
  it('resolves the identifiers it is given into run cards', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Passed')]),
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
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Passed')])]);
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
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Passed')])]);
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

  it('persists each recorded result on the case currently under execution', async () => {
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
    expect(screen.getByText('0 passed · 0 failed · 0 blocked · 2 untested')).toBeDefined();
    expect(screen.getByText(/navigate to \/login/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /mark passed/i }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Marked Verify Login as Passed.'),
    );
    expect(api.calls).toContain('PUT /api/test_runs/RUN-1.json');
    expect(api.updated[0]?.testCases?.[0]?.priority).toBe('Passed');
    expect(api.updated[0]?.testCases?.[1]?.priority).toBeUndefined();
    expect(await screen.findByText('Case 1 of 2: Verify Login is Passed.')).toBeDefined();
    expect(screen.getByText('1 passed · 0 failed · 0 blocked · 1 untested')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /next case/i }));
    expect(await screen.findByText('Case 2 of 2: Submit Order is Untested.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /mark blocked/i }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Marked Submit Order as Blocked.'),
    );
    expect(api.updated[1]?.testCases?.[0]?.priority).toBe('Passed');
    expect(api.updated[1]?.testCases?.[1]?.priority).toBe('Blocked');
  });

  it('resets a recorded result back to untested', async () => {
    const api = createStubApi([run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Failed')])]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Execute RUN-1.json' }));
    expect(await screen.findByText('Case 1 of 1: Verify Login is Failed.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /reset untested/i }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Marked Verify Login as Untested.'),
    );
    expect(api.updated[0]?.testCases?.[0]?.priority).toBe('Untested');
    expect(await screen.findByText('Case 1 of 1: Verify Login is Untested.')).toBeDefined();
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
    expect(screen.queryByRole('button', { name: /mark passed/i })).toBeNull();

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

  it('has no detectable WCAG 2.1 AA violations, including the delete confirmation', async () => {
    const api = createStubApi([
      run('RUN-1.json', [testCase('TC-1.json', 'Verify Login', 'Passed')]),
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
});
