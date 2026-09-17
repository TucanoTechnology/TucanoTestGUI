import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import TestSuitesModule from './TestSuitesModule';
import { TucanoApiClient } from '../../api/client';

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
  options: { failDetail?: boolean; failMutation?: boolean } = {},
): StubApi {
  const identifiers = [...initial];
  const names = new Map(identifiers.map((id) => [id, `Suite ${id}`]));
  const calls: string[] = [];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the module can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
    }

    const detail = /\/test_suites\/(.+)$/.exec(urlStr);
    const detailId = detail?.[1] ? decodeURIComponent(detail[1]) : null;

    if (method === 'GET') {
      if (detailId) {
        if (options.failDetail || !identifiers.includes(detailId)) {
          return json(
            { error: { code: 'not_found', message: `Test suite ${detailId} could not be read` } },
            404,
          );
        }
        return json({
          suiteId: detailId,
          name: names.get(detailId),
          description: `${detailId} description`,
          testCases: [],
        });
      }
      return json(identifiers);
    }

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { suiteId: string; name: string };
      identifiers.push(body.suiteId);
      names.set(body.suiteId, body.name);
      return json({ id: body.suiteId }, 201);
    }

    if (method === 'PUT' && detailId) {
      const body = JSON.parse(String(init?.body)) as { name: string };
      names.set(detailId, body.name);
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

/**
 * Stands in for the shell: it owns the filtered identifier list, triggers the
 * create form, and re-lists on demand exactly as App does.
 */
function ShellHarness({
  client,
  onStatus,
  initial = ['SmokeTest.json'],
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
        New suite
      </button>
      <TestSuitesModule
        client={client}
        identifiers={identifiers}
        createRequest={createRequest}
        onStatus={onStatus}
        onChanged={async () => setIdentifiers(await client.listTestSuites())}
      />
    </>
  );
}

describe('TestSuitesModule', () => {
  it('resolves the identifiers it is given into suite cards', async () => {
    const api = createStubApi(['SmokeTest.json', 'Regression.json']);

    render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json', 'Regression.json']}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Details for SmokeTest.json' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Details for / }).length).toBe(2);
    expect(screen.getByText('📁 Suite SmokeTest.json')).toBeDefined();
    expect(screen.getByText('Regression.json description')).toBeDefined();
  });

  it('shows a loading state until the details arrive, then only the cards', async () => {
    const api = createStubApi(['SmokeTest.json']);

    render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json']}
        onStatus={vi.fn()}
      />,
    );

    expect(screen.getByText('Fetching suite details…')).toBeDefined();

    await screen.findByRole('button', { name: 'Details for SmokeTest.json' });
    expect(screen.queryByText('Fetching suite details…')).toBeNull();
  });

  it('renders an empty state when the filtered list has no suites', async () => {
    const api = createStubApi([]);

    render(<TestSuitesModule client={api.client} identifiers={[]} onStatus={vi.fn()} />);

    expect(await screen.findByText('No test suites to show.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Details for / })).toBeNull();
  });

  it('surfaces the API error envelope when a detail cannot be read', async () => {
    const api = createStubApi(['SmokeTest.json'], { failDetail: true });
    const onStatus = vi.fn();

    render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json']}
        onStatus={onStatus}
      />,
    );

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(
      screen.getByText(/could not load suite details: test suite SmokeTest\.json could not be read/i),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Details for / })).toBeNull();
    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load suite details: Test suite SmokeTest.json could not be read',
        'error',
      ),
    );
  });

  it('creates a suite through the client, refreshes the list and announces it', async () => {
    const api = createStubApi([]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} initial={[]} />);
    await screen.findByText('No test suites to show.');

    fireEvent.click(screen.getByRole('button', { name: 'New suite' }));
    expect(screen.getByRole('dialog', { name: /create new test suite/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/suite id/i), { target: { value: 'NewSuite' } });
    fireEvent.change(screen.getByLabelText(/suite name/i), { target: { value: 'New Suite' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Covers login' } });
    fireEvent.submit(screen.getByRole('button', { name: /save test suite/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test suite NewSuite.json created successfully.'),
    );
    expect(screen.queryByRole('dialog', { name: /create new test suite/i })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Details for NewSuite.json' })).toBeDefined();
    expect(api.calls).toContain('POST /api/test_suites');
  });

  it('edits a suite and reports the refreshed name', async () => {
    const api = createStubApi(['SmokeTest.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit SmokeTest.json' }));

    expect(screen.getByRole('dialog', { name: /edit test suite: SmokeTest\.json/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/suite name/i), { target: { value: 'Renamed Suite' } });
    fireEvent.submit(screen.getByRole('button', { name: /update test suite/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test suite SmokeTest.json updated successfully.'),
    );
    expect(await screen.findByText('📁 Renamed Suite')).toBeDefined();
    expect(api.calls).toContain('PUT /api/test_suites/SmokeTest.json');
  });

  it('requires an explicit confirmation before deleting a suite', async () => {
    const api = createStubApi(['SmokeTest.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete SmokeTest.json' }));

    expect(
      screen.getByRole('group', { name: 'Confirm deletion of SmokeTest.json' }),
    ).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Test suite SmokeTest.json deleted.'),
    );
    expect(api.calls).toContain('DELETE /api/test_suites/SmokeTest.json');
    expect(await screen.findByText('No test suites to show.')).toBeDefined();
  });

  it('keeps the suite when the deletion is cancelled', async () => {
    const api = createStubApi(['SmokeTest.json']);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete SmokeTest.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: /confirm deletion/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete SmokeTest.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('reports a refused mutation through the shared status region', async () => {
    const api = createStubApi(['SmokeTest.json'], { failMutation: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete SmokeTest.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not delete test suite: Storage is read-only',
        'error',
      ),
    );
  });

  it('hands the resolved entity to the shell when details are requested', async () => {
    const api = createStubApi(['SmokeTest.json']);
    const onViewSuite = vi.fn();

    render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json']}
        onStatus={vi.fn()}
        onViewSuite={onViewSuite}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Details for SmokeTest.json' }));

    expect(onViewSuite).toHaveBeenCalledWith(
      expect.objectContaining({ suiteId: 'SmokeTest.json', name: 'Suite SmokeTest.json' }),
    );
  });

  it('has no detectable WCAG 2.1 AA violations, including the delete confirmation', async () => {
    const api = createStubApi(['SmokeTest.json', 'Regression.json']);

    const { container } = render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json', 'Regression.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete SmokeTest.json' }));
    expect(
      screen.getByRole('group', { name: 'Confirm deletion of SmokeTest.json' }),
    ).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the create form open', async () => {
    const api = createStubApi(['SmokeTest.json']);

    const { container } = render(
      <TestSuitesModule
        client={api.client}
        identifiers={['SmokeTest.json']}
        createRequest={1}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByRole('dialog', { name: /create new test suite/i })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
