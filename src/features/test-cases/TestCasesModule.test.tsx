import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import TestCasesModule from './TestCasesModule';
import { Project, TucanoApiClient } from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface StubApi {
  client: TucanoApiClient;
  calls: string[];
  identifiers: string[];
}

/** Routed stub: the identifier list, details, and the three mutations. */
function createStubApi(
  initial: string[],
  options: { failDetail?: boolean; failMutation?: boolean; titles?: Record<string, string> } = {},
): StubApi {
  const identifiers = [...initial];
  const titles = new Map(initial.map((id) => [id, options.titles?.[id] ?? `Case ${id}`]));
  const statuses = new Map<string, string>();
  const calls: string[] = [];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the board can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
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
          priority: statuses.get(detailId) ?? 'Medium',
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
      if (body.priority) statuses.set(detailId, body.priority);
      return json({ id: detailId });
    }

    if (method === 'DELETE' && detailId) {
      identifiers.splice(identifiers.indexOf(detailId), 1);
      return json({});
    }

    return json([]);
  }) as unknown as typeof fetch;

  return { client: new TucanoApiClient('/api', stubFetch), calls, identifiers };
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
 * create form, and re-lists on demand exactly as App does.
 */
function ShellHarness({
  client,
  onStatus,
  initial = ['TC-1.json'],
  projects = [],
  suites = [],
  onCreateSuite = vi.fn(),
  onCreateProject = vi.fn(),
  onCreateTestRun = vi.fn(),
}: {
  client: TucanoApiClient;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  initial?: string[];
  projects?: Project[];
  suites?: never[];
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

  it('marks every selected case through the bulk actions and clears the selection', async () => {
    const api = createStubApi(['TC-1.json', 'TC-2.json']);
    const onStatus = vi.fn();

    render(
      <ShellHarness client={api.client} onStatus={onStatus} initial={['TC-1.json', 'TC-2.json']} />,
    );
    await screen.findByRole('button', { name: 'Actions for Case TC-1.json' });

    fireEvent.click(screen.getByLabelText('Select Case TC-1.json'));
    fireEvent.click(screen.getByLabelText('Select Case TC-2.json'));
    expect(screen.getByText('2 cases selected')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mark passed' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Marked 2 test cases as Passed.'),
    );
    expect(api.calls).toContain('PUT /api/test_cases/TC-1.json');
    expect(api.calls).toContain('PUT /api/test_cases/TC-2.json');
    expect(screen.queryByText(/cases selected/)).toBeNull();
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
    const api = createStubApi(['TC-1.json', 'TC-2.json']);
    const onStatus = vi.fn();

    render(
      <ShellHarness client={api.client} onStatus={onStatus} initial={['TC-1.json', 'TC-2.json']} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Case TC-1.json' }));
    await screen.findByRole('button', { name: 'Close detail panel' });
    expect(screen.getByText('ID: TC-1.json')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Steps & Description' })).toBeDefined();

    const previous = () => screen.getByRole('button', { name: 'Previous test case' }) as HTMLButtonElement;
    expect(previous().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /pass & next/i }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Updated TC-1.json status to Passed.'),
    );
    expect(await screen.findByText('ID: TC-2.json')).toBeDefined();
    await waitFor(() => expect(previous().disabled).toBe(false));
    expect(api.calls).toContain('PUT /api/test_cases/TC-1.json');
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
});
