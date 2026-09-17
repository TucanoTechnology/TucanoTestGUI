import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import ProjectsModule from './ProjectsModule';
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
  const names = new Map(identifiers.map((id) => [id, `Project ${id}`]));
  const calls: string[] = [];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    // Reads keep working so the module can render; only writes are refused.
    if (options.failMutation && method !== 'GET') {
      return json({ error: { code: 'read_only', message: 'Storage is read-only' } }, 409);
    }

    const detail = /\/projects\/(.+)$/.exec(urlStr);
    const detailId = detail?.[1] ? decodeURIComponent(detail[1]) : null;

    if (method === 'GET') {
      if (detailId) {
        if (options.failDetail || !identifiers.includes(detailId)) {
          return json(
            { error: { code: 'not_found', message: `Project ${detailId} could not be read` } },
            404,
          );
        }
        return json({
          projectId: detailId,
          name: names.get(detailId),
          description: `${detailId} description`,
          testSuites: [],
        });
      }
      return json(identifiers);
    }

    if (method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { projectId: string; name: string };
      identifiers.push(body.projectId);
      names.set(body.projectId, body.name);
      return json({ id: body.projectId }, 201);
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
  initial = ['PROJ-1.json'],
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
        New project
      </button>
      <ProjectsModule
        client={client}
        identifiers={identifiers}
        createRequest={createRequest}
        onStatus={onStatus}
        onChanged={async () => setIdentifiers(await client.listProjects())}
      />
    </>
  );
}

describe('ProjectsModule', () => {
  it('resolves the identifiers it is given into project cards', async () => {
    const api = createStubApi(['PROJ-1.json', 'PROJ-2.json']);

    render(
      <ProjectsModule
        client={api.client}
        identifiers={['PROJ-1.json', 'PROJ-2.json']}
        onStatus={vi.fn()}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Details for PROJ-1.json' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Details for / }).length).toBe(2);
    expect(screen.getByText('🏢 Project PROJ-1.json')).toBeDefined();
    expect(screen.getByText('PROJ-2.json description')).toBeDefined();
  });

  it('shows a loading state until the details arrive, then only the cards', async () => {
    const api = createStubApi(['PROJ-1.json']);

    render(<ProjectsModule client={api.client} identifiers={['PROJ-1.json']} onStatus={vi.fn()} />);

    expect(screen.getByText('Fetching project details…')).toBeDefined();

    await screen.findByRole('button', { name: 'Details for PROJ-1.json' });
    expect(screen.queryByText('Fetching project details…')).toBeNull();
  });

  it('renders an empty state when the filtered list has no projects', async () => {
    const api = createStubApi([]);

    render(<ProjectsModule client={api.client} identifiers={[]} onStatus={vi.fn()} />);

    expect(await screen.findByText('No projects to show.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Details for / })).toBeNull();
  });

  it('surfaces the API error envelope when a detail cannot be read', async () => {
    const api = createStubApi(['PROJ-1.json'], { failDetail: true });
    const onStatus = vi.fn();

    render(<ProjectsModule client={api.client} identifiers={['PROJ-1.json']} onStatus={onStatus} />);

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(screen.getByText(/could not load project details: project PROJ-1\.json could not be read/i)).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Details for / })).toBeNull();
    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not load project details: Project PROJ-1.json could not be read',
        'error',
      ),
    );
  });

  it('creates a project through the client, refreshes the list and announces it', async () => {
    const api = createStubApi([]);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} initial={[]} />);
    await screen.findByText('No projects to show.');

    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(screen.getByRole('dialog', { name: /create new project/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/project id/i), { target: { value: 'PROJ-9' } });
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Checkout App' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Cart to order' } });
    fireEvent.submit(screen.getByRole('button', { name: /save project/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Project PROJ-9.json created successfully.'),
    );
    expect(screen.queryByRole('dialog', { name: /create new project/i })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Details for PROJ-9.json' })).toBeDefined();
    expect(screen.getByText('🏢 Checkout App')).toBeDefined();
    expect(api.calls).toContain('POST /api/projects');
  });

  it('edits a project and reports the refreshed name', async () => {
    const api = createStubApi(['PROJ-1.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit PROJ-1.json' }));

    expect(screen.getByRole('dialog', { name: /edit project: PROJ-1\.json/i })).toBeDefined();
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Renamed App' } });
    fireEvent.submit(screen.getByRole('button', { name: /update project/i }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Project PROJ-1.json updated successfully.'),
    );
    expect(await screen.findByText('🏢 Renamed App')).toBeDefined();
    expect(api.calls).toContain('PUT /api/projects/PROJ-1.json');
  });

  it('requires an explicit confirmation before deleting a project', async () => {
    const api = createStubApi(['PROJ-1.json']);
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete PROJ-1.json' }));

    expect(screen.getByRole('group', { name: 'Confirm deletion of PROJ-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(onStatus).toHaveBeenCalledWith('Project PROJ-1.json deleted.'));
    expect(api.calls).toContain('DELETE /api/projects/PROJ-1.json');
    expect(await screen.findByText('No projects to show.')).toBeDefined();
  });

  it('keeps the project when the deletion is cancelled', async () => {
    const api = createStubApi(['PROJ-1.json']);

    render(<ShellHarness client={api.client} onStatus={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete PROJ-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('group', { name: /confirm deletion/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete PROJ-1.json' })).toBeDefined();
    expect(api.calls.some((call) => call.startsWith('DELETE'))).toBe(false);
  });

  it('reports a refused mutation through the shared status region', async () => {
    const api = createStubApi(['PROJ-1.json'], { failMutation: true });
    const onStatus = vi.fn();

    render(<ShellHarness client={api.client} onStatus={onStatus} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete PROJ-1.json' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Could not delete project: Storage is read-only', 'error'),
    );
  });

  it('has no detectable WCAG 2.1 AA violations, including the delete confirmation', async () => {
    const api = createStubApi(['PROJ-1.json', 'PROJ-2.json']);

    const { container } = render(
      <ProjectsModule
        client={api.client}
        identifiers={['PROJ-1.json', 'PROJ-2.json']}
        onStatus={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete PROJ-1.json' }));
    expect(screen.getByRole('group', { name: 'Confirm deletion of PROJ-1.json' })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations with the create form open', async () => {
    const api = createStubApi(['PROJ-1.json']);

    const { container } = render(
      <ProjectsModule
        client={api.client}
        identifiers={['PROJ-1.json']}
        createRequest={1}
        onStatus={vi.fn()}
      />,
    );
    expect(await screen.findByRole('dialog', { name: /create new project/i })).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
