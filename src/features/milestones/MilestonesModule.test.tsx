import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import MilestonesModule, { clampPercentage, passRateLabel } from './MilestonesModule';
import { Milestone, MilestoneProgress, TucanoApiClient } from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function milestone(id: string, overrides: Partial<Milestone> = {}): Milestone {
  return { milestoneId: id, name: id.replace(/\.json$/, ''), status: 'Open', ...overrides };
}

function progressFor(id: string, overrides: Partial<MilestoneProgress> = {}): MilestoneProgress {
  return {
    milestoneId: id,
    totalCases: 4,
    passed: 3,
    failed: 1,
    blocked: 0,
    untested: 0,
    retest: 0,
    passPercentage: 50,
    ...overrides,
  };
}

interface StubApi {
  client: TucanoApiClient;
  calls: string[];
  milestones: Map<string, Milestone>;
  created: Milestone[];
  updated: Milestone[];
}

/** Routed stub: the milestone list, the details, the release summary and the CRUD writes. */
function createStubApi(
  initial: Milestone[],
  options: {
    failDetail?: boolean;
    failProgress?: boolean;
    failMutation?: boolean;
    percentage?: number;
  } = {},
): StubApi {
  const milestones = new Map(initial.map((entity) => [entity.milestoneId, entity]));
  const calls: string[] = [];
  const created: Milestone[] = [];
  const updated: Milestone[] = [];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the module can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
    }

    const progress = /\/milestones\/(.+)\/progress$/.exec(urlStr);
    if (method === 'GET' && progress?.[1]) {
      const id = decodeURIComponent(progress[1]);
      if (options.failProgress || !milestones.has(id)) {
        return json(
          { error: { code: 'not_found', message: `Milestone ${id} has no progress` } },
          404,
        );
      }
      return json(progressFor(id, options.percentage === undefined ? {} : { passPercentage: options.percentage }));
    }

    const detail = /\/milestones\/(.+)$/.exec(urlStr);
    const detailId = detail?.[1] ? decodeURIComponent(detail[1]) : null;

    if (method === 'GET') {
      if (detailId) {
        const found = milestones.get(detailId);
        if (options.failDetail || !found) {
          return json(
            { error: { code: 'not_found', message: `Milestone ${detailId} could not be read` } },
            404,
          );
        }
        return json(found);
      }
      return json([...milestones.keys()]);
    }

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as Milestone;
      created.push(body);
      milestones.set(body.milestoneId, body);
      return json({ id: body.milestoneId }, 201);
    }

    if (method === 'PUT' && detailId) {
      const body = JSON.parse(String(init?.body)) as Milestone;
      updated.push(body);
      milestones.set(detailId, body);
      return json({ id: detailId });
    }

    if (method === 'DELETE' && detailId) {
      milestones.delete(detailId);
      return json({});
    }

    return json([]);
  }) as unknown as typeof fetch;

  return { client: new TucanoApiClient('/api', stubFetch), calls, milestones, created, updated };
}

/**
 * Stands in for the shell: it owns the filtered identifier list, triggers the
 * create form, and re-lists on demand exactly as App does.
 */
function ShellHarness({
  client,
  onStatus,
  initial = ['M-1.json'],
}: {
  client: TucanoApiClient;
  onStatus: (message: string, state?: 'info' | 'error') => void;
  initial?: string[];
}) {
  const [identifiers, setIdentifiers] = useState<string[]>(initial);
  const [createRequest, setCreateRequest] = useState(0);

  return (
    <>
      <button type="button" onClick={() => setCreateRequest((count) => count + 1)}>
        Create milestone
      </button>
      <MilestonesModule
        client={client}
        identifiers={identifiers}
        createRequest={createRequest}
        onStatus={onStatus}
        onChanged={async () => setIdentifiers(await client.listMilestones())}
      />
    </>
  );
}

describe('release summary presentation', () => {
  it('formats the pass rate the API reports', () => {
    expect(passRateLabel(progressFor('M-1.json'))).toBe('50.0%');
    expect(passRateLabel(progressFor('M-1.json', { passPercentage: 66.666 }))).toBe('66.7%');
    expect(passRateLabel(progressFor('M-1.json', { passPercentage: 0 }))).toBe('0.0%');
    expect(passRateLabel(progressFor('M-1.json', { passPercentage: 100 }))).toBe('100.0%');
  });

  it('bounds a fill that cannot be painted', () => {
    expect(clampPercentage(50)).toBe(50);
    expect(clampPercentage(140)).toBe(100);
    expect(clampPercentage(-5)).toBe(0);
    expect(clampPercentage(Number.NaN)).toBe(0);
    // A value that is not a finite number at all cannot be painted either.
    expect(clampPercentage(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('MilestonesModule', () => {
  it('resolves the identifiers it is given into milestone cards', async () => {
    const api = createStubApi([
      milestone('M-1.json', {
        name: 'v1.0-RC1',
        status: 'In Progress',
        startDate: '2026-09-01',
        targetDate: '2026-09-30',
        description: 'First release candidate',
        testSuiteIds: ['SmokeTest.json'],
        testRunIds: ['RUN-1.json', 'RUN-2.json'],
      }),
      milestone('M-2.json', { name: 'v1.1' }),
    ]);

    render(
      <MilestonesModule
        client={api.client}
        identifiers={['M-1.json', 'M-2.json']}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Progress for M-1.json' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Progress for / }).length).toBe(2);
    expect(screen.getByText('🎯 v1.0-RC1')).toBeDefined();
    expect(screen.getByText('M-1.json')).toBeDefined();
    expect(screen.getByText('Status: In Progress')).toBeDefined();
    expect(screen.getByText('2026-09-01 → 2026-09-30')).toBeDefined();
    expect(screen.getByText('1 linked suites, 2 linked runs')).toBeDefined();
    expect(screen.getByText('First release candidate')).toBeDefined();
    // An unscheduled milestone says so rather than showing an empty range.
    expect(screen.getByText('Status: Open')).toBeDefined();
    expect(screen.queryByText(/→ no target/)).toBeNull();
  });

  it('shows a loading state until the details arrive, then only the cards', async () => {
    const api = createStubApi([milestone('M-1.json')]);

    render(
      <MilestonesModule client={api.client} identifiers={['M-1.json']} onStatus={vi.fn()} />,
    );

    expect(screen.getByText('Fetching milestone details…')).toBeDefined();

    await screen.findByRole('button', { name: 'Progress for M-1.json' });
    expect(screen.queryByText('Fetching milestone details…')).toBeNull();
  });

  it('renders an empty state when the filtered list has no milestones', async () => {
    const api = createStubApi([]);

    render(<MilestonesModule client={api.client} identifiers={[]} onStatus={vi.fn()} />);

    expect(await screen.findByText('No milestones to show.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Progress for / })).toBeNull();
  });

  it('surfaces the API error envelope when a milestone cannot be read', async () => {
    const api = createStubApi([milestone('M-1.json')], { failDetail: true });
    const onStatus = vi.fn();

    render(
      <MilestonesModule client={api.client} identifiers={['M-1.json']} onStatus={onStatus} />,
    );

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(
      screen.getByText(/could not load milestone details: milestone M-1\.json could not be read/i),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Progress for / })).toBeNull();
    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load milestone details: Milestone M-1.json could not be read',
        'error',
      ),
    );
  });

  it('creates a milestone, normalising the identifier into a filename', async () => {
    const api = createStubApi([milestone('M-1.json')]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    await screen.findByRole('button', { name: 'Progress for M-1.json' });

    fireEvent.click(screen.getByRole('button', { name: 'Create milestone' }));
    expect(screen.getByRole('dialog', { name: /create new milestone/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/milestone id \(filename\)/i), {
      target: { value: 'Sprint42' },
    });
    fireEvent.change(screen.getByLabelText(/milestone name/i), {
      target: { value: 'Release v1.0' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /save milestone/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Milestone Sprint42.json created successfully.'),
    );
    expect(api.calls).toContain('POST /api/milestones');
    expect(api.created[0]?.milestoneId).toBe('Sprint42.json');
    expect(api.created[0]?.name).toBe('Release v1.0');
    expect(api.created[0]?.status).toBe('Open');
    expect(api.created[0]?.testSuiteIds).toEqual([]);
    expect(api.created[0]?.testRunIds).toEqual([]);
    expect(api.created[0]?.startDate).toBeUndefined();
    expect(screen.queryByRole('dialog', { name: /create new milestone/i })).toBeNull();
    // The refreshed identifier list brings the created milestone into view.
    expect(await screen.findByRole('button', { name: 'Progress for Sprint42.json' })).toBeDefined();
  });

  it('clears the create form when it is dismissed and re-opened', async () => {
    const api = createStubApi([milestone('M-1.json')]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    await screen.findByRole('button', { name: 'Edit M-1.json' });
    fireEvent.click(screen.getByRole('button', { name: 'Create milestone' }));

    const idField = screen.getByLabelText(/milestone id \(filename\)/i) as HTMLInputElement;
    const statusField = screen.getByLabelText(/^status$/i) as HTMLSelectElement;
    expect(statusField.value).toBe('Open');

    fireEvent.change(idField, { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: /create new milestone/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create milestone' }));
    expect((screen.getByLabelText(/milestone id \(filename\)/i) as HTMLInputElement).value).toBe('');
  });

  it('edits the name, dates, status and description through the API', async () => {
    const api = createStubApi([milestone('M-1.json', { name: 'v1.0-RC1' })]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit M-1.json' }));

    expect(screen.getByRole('dialog', { name: /edit milestone: M-1\.json/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/milestone name/i), {
      target: { value: 'Release v1.0' },
    });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-09-30' } });
    fireEvent.change(screen.getByLabelText(/^status$/i), { target: { value: 'In Progress' } });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Release goal and scope' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /update milestone/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Milestone M-1.json updated successfully.'),
    );
    expect(api.calls).toContain('PUT /api/milestones/M-1.json');
    expect(api.updated[0]?.milestoneId).toBe('M-1.json');
    expect(api.updated[0]?.name).toBe('Release v1.0');
    expect(api.updated[0]?.startDate).toBe('2026-09-01');
    expect(api.updated[0]?.targetDate).toBe('2026-09-30');
    expect(api.updated[0]?.status).toBe('In Progress');
    expect(api.updated[0]?.description).toBe('Release goal and scope');
    expect(screen.queryByRole('dialog', { name: /edit milestone/i })).toBeNull();
  });

  it('requires an explicit confirmation before deleting a milestone', async () => {
    const api = createStubApi([milestone('M-1.json')]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete M-1.json' }));

    expect(screen.getByRole('group', { name: 'Confirm deletion of M-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Milestone M-1.json deleted.'));
    expect(api.calls).toContain('DELETE /api/milestones/M-1.json');
    expect(await screen.findByText('No milestones to show.')).toBeDefined();
  });

  it('keeps the milestone when the deletion is cancelled', async () => {
    const api = createStubApi([milestone('M-1.json')]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete M-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: /confirm deletion/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete M-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('reports a refused mutation through the shared status region', async () => {
    const api = createStubApi([milestone('M-1.json')], { failMutation: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete M-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not delete milestone: Storage is read-only',
        'error',
      ),
    );
    // The list came from a read that still works, so it stays usable.
    expect(screen.getByRole('button', { name: 'Delete M-1.json' })).toBeDefined();
  });

  it('renders the release summary the API computes for the selected milestone', async () => {
    const api = createStubApi([
      milestone('M-1.json', {
        name: 'v1.0-RC1',
        status: 'In Progress',
        startDate: '2026-09-01',
        targetDate: '2026-09-30',
        testSuiteIds: ['SmokeTest.json'],
        testRunIds: ['RUN-1.json'],
      }),
    ]);
    const onStatus = vi.fn();

    const { container } = render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Progress for M-1.json' }));

    expect(await screen.findByText('Milestone Progress: M-1.json')).toBeDefined();
    expect(screen.getByText('Pass rate for M-1.json: 50.0% over 4 cases.')).toBeDefined();
    expect(screen.getByText('Total cases: 4')).toBeDefined();
    expect(screen.getByText('Passed: 3')).toBeDefined();
    expect(screen.getByText('Failed: 1')).toBeDefined();
    expect(screen.getByText('Blocked: 0')).toBeDefined();
    expect(screen.getByText('Untested: 0')).toBeDefined();
    expect(screen.getByText('Retest: 0')).toBeDefined();
    expect(screen.getByText('Linked test suites (1)')).toBeDefined();
    expect(screen.getByText('SmokeTest.json')).toBeDefined();
    expect(screen.getByText('Linked test runs (1)')).toBeDefined();
    expect(screen.getByText('RUN-1.json')).toBeDefined();

    const bar = screen.getByRole('progressbar', { name: 'Pass rate for M-1.json' });
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(container.querySelector<HTMLElement>('.progress-bar')?.style.width).toBe('50%');

    const trigger = screen.getByRole('button', { name: 'Progress for M-1.json' });
    expect(trigger.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Showing progress for M-1.json.'));
  });

  it('bounds the fill when the API reports a percentage outside 0–100', async () => {
    const api = createStubApi([milestone('M-1.json')], { percentage: 140 });

    const { container } = render(
      <MilestonesModule client={api.client} identifiers={['M-1.json']} onStatus={vi.fn()} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Progress for M-1.json' }));

    expect(await screen.findByText(/pass rate for M-1\.json: 140\.0%/i)).toBeDefined();
    expect(container.querySelector<HTMLElement>('.progress-bar')?.style.width).toBe('100%');
    // The sentence states the API's percentage; the bar stays inside its range.
    expect(
      screen.getByRole('progressbar', { name: 'Pass rate for M-1.json' }).getAttribute('aria-valuenow'),
    ).toBe('100');
  });

  it('closes the release summary and returns to the idle hint', async () => {
    const api = createStubApi([milestone('M-1.json')]);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    expect(screen.getByText(/select a milestone and choose progress/i)).toBeDefined();

    fireEvent.click(await screen.findByRole('button', { name: 'Progress for M-1.json' }));
    await screen.findByText('Milestone Progress: M-1.json');

    fireEvent.click(screen.getByRole('button', { name: 'Close progress' }));

    expect(screen.queryByText('Milestone Progress: M-1.json')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText(/select a milestone and choose progress/i)).toBeDefined();
  });

  it('reports a summary it cannot read without losing the list', async () => {
    const api = createStubApi([milestone('M-1.json')], { failProgress: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Progress for M-1.json' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load milestone progress: Milestone M-1.json has no progress',
        'error',
      ),
    );
    expect(screen.getByText('Error code: not_found')).toBeDefined();
    expect(screen.getByText(/could not load milestone progress/i)).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete M-1.json' })).toBeDefined();
  });

  it('has no detectable WCAG 2.1 AA violations, including the delete confirmation', async () => {
    const api = createStubApi([
      milestone('M-1.json', { name: 'v1.0-RC1', testRunIds: ['RUN-1.json'] }),
      milestone('M-2.json', { name: 'v1.1' }),
    ]);

    const { container } = render(
      <MilestonesModule
        client={api.client}
        identifiers={['M-1.json', 'M-2.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete M-1.json' }));
    expect(screen.getByRole('group', { name: 'Confirm deletion of M-1.json' })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the create form open', async () => {
    const api = createStubApi([milestone('M-1.json')]);

    const { container } = render(
      <MilestonesModule
        client={api.client}
        identifiers={['M-1.json']}
        createRequest={1}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByRole('dialog', { name: /create new milestone/i })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations on the release summary', async () => {
    const api = createStubApi([
      milestone('M-1.json', {
        name: 'v1.0-RC1',
        status: 'In Progress',
        startDate: '2026-09-01',
        targetDate: '2026-09-30',
        description: 'First release candidate',
        testSuiteIds: ['SmokeTest.json'],
        testRunIds: ['RUN-1.json'],
      }),
    ]);

    const { container } = render(
      <MilestonesModule
        client={api.client}
        identifiers={['M-1.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Progress for M-1.json' }));
    await screen.findByText('Milestone Progress: M-1.json');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
