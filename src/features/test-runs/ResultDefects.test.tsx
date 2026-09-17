import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import ResultDefects from './ResultDefects';
import { DefectLink, DefectLinkInput, TucanoApiClient } from '../../api/client';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function defectLink(overrides: Partial<DefectLink> = {}): DefectLink {
  return {
    linkId: 'LINK-1',
    defectId: 'PROJ-42',
    defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
    trackerType: 'jira',
    title: 'Login rejects a valid user',
    linkedAt: '1757030400',
    ...overrides,
  };
}

interface Options {
  failList?: boolean;
  failLink?: boolean;
  failUnlink?: boolean;
}

/**
 * A routed stub of the two defect endpoints. Links are stored and returned the
 * way the API stores them, so a test can tell a re-read from a local echo.
 */
function createStubApi(initial: DefectLink[], options: Options = {}) {
  let links = [...initial];
  let sequence = initial.length;
  const calls: string[] = [];
  const linked: DefectLinkInput[] = [];
  const unlinked: string[] = [];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${urlStr}`);

    const unlinkMatch = /\/defects\/([^/]+)$/.exec(urlStr);
    if (unlinkMatch?.[1]) {
      if (method !== 'DELETE' || options.failUnlink) {
        return json({ error: { code: 'not_found', message: 'That link is gone' } }, 404);
      }
      const linkId = decodeURIComponent(unlinkMatch[1]);
      unlinked.push(linkId);
      links = links.filter((link) => link.linkId !== linkId);
      return json({ message: 'Defect unlinked.' });
    }

    if (!/\/defects$/.test(urlStr)) {
      return json({ error: { code: 'not_found', message: `No route for ${urlStr}` } }, 404);
    }

    if (method === 'GET') {
      if (options.failList) {
        return json(
          { error: { code: 'not_found', message: 'Test run RUN-1.json could not be read' } },
          404,
        );
      }
      return json({ defects: links });
    }

    if (method === 'POST') {
      if (options.failLink) {
        return json(
          { error: { code: 'conflict', message: 'That defect is already linked to this result' } },
          409,
        );
      }
      const body = JSON.parse(String(init?.body)) as DefectLinkInput;
      linked.push(body);
      sequence += 1;
      const created = defectLink({ ...body, linkId: `LINK-${sequence}`, linkedAt: '1757030500' });
      links = [...links, created];
      return json({ id: created.linkId, message: 'Defect linked.' }, 201);
    }

    return json({ error: { code: 'invalid_request', message: 'Unsupported method' } }, 400);
  }) as unknown as typeof fetch;

  return { client: new TucanoApiClient('/api', stubFetch), calls, linked, unlinked };
}

function renderPanel(api: ReturnType<typeof createStubApi>, onStatus = vi.fn()) {
  const view = render(
    <ResultDefects
      client={api.client}
      runId="RUN-1.json"
      caseId="TC-1.json"
      onStatus={onStatus}
    />,
  );
  return { ...view, onStatus };
}

describe('ResultDefects', () => {
  it('lists the defects the API holds for the result', async () => {
    const api = createStubApi([
      defectLink(),
      defectLink({
        linkId: 'LINK-2',
        defectId: '1234',
        defectUrl: 'https://github.com/acme/app/issues/1234',
        trackerType: 'github',
        title: 'Order total is wrong',
      }),
    ]);

    renderPanel(api);

    expect(await screen.findByText('Linked defects (2)')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Login rejects a valid user' })).toBeDefined();
    expect(
      (screen.getByRole('link', { name: 'Login rejects a valid user' }) as HTMLAnchorElement).href,
    ).toBe('https://acme.atlassian.net/browse/PROJ-42');
    expect(screen.getByText(/PROJ-42 in jira/)).toBeDefined();
    expect(screen.getByText(/1234 in github/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unlink defect PROJ-42' })).toBeDefined();
    expect(api.calls).toEqual(['GET /api/test_runs/RUN-1.json/results/TC-1.json/defects']);
  });

  it('reports an empty list instead of inventing a link', async () => {
    renderPanel(createStubApi([]));

    expect(await screen.findByText('No defects linked to this result.')).toBeDefined();
    expect(screen.getByText('Linked defects (0)')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Unlink defect/ })).toBeNull();
  });

  it('shows a loading state until the links arrive', async () => {
    renderPanel(createStubApi([defectLink()]));

    expect(screen.getByText('Fetching linked defects…')).toBeDefined();
    await screen.findByText('Linked defects (1)');
    expect(screen.queryByText('Fetching linked defects…')).toBeNull();
  });

  it('surfaces the API error envelope and announces it when the list cannot be read', async () => {
    renderPanel(createStubApi([], { failList: true }));

    expect(await screen.findByText('Error code: not_found')).toBeDefined();
    expect(
      screen.getByText('Could not load linked defects: Test run RUN-1.json could not be read'),
    ).toBeDefined();
    expect(screen.getByText('Could not load linked defects for TC-1.json.')).toBeDefined();
  });

  it('renders a stored non-https address as text rather than a link', async () => {
    renderPanel(
      createStubApi([
        defectLink({ defectUrl: 'javascript:alert(1)', title: undefined, trackerType: 'custom' }),
      ]),
    );

    expect(await screen.findByText('Linked defects (1)')).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('links a defect with the tracker the select names and then re-reads the list', async () => {
    const api = createStubApi([]);
    const { onStatus } = renderPanel(api);
    await screen.findByText('No defects linked to this result.');

    fireEvent.change(screen.getByLabelText('Tracker'), { target: { value: 'github' } });
    fireEvent.change(screen.getByLabelText('Defect ID'), { target: { value: '1234' } });
    fireEvent.change(screen.getByLabelText('Defect URL'), {
      target: { value: 'https://github.com/acme/app/issues/1234' },
    });
    fireEvent.change(screen.getByLabelText('Title (optional)'), {
      target: { value: 'Order total is wrong' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Link defect' }).closest('form')!);

    await waitFor(() =>
      expect(api.linked).toEqual([
        {
          defectId: '1234',
          defectUrl: 'https://github.com/acme/app/issues/1234',
          trackerType: 'github',
          title: 'Order total is wrong',
        },
      ]),
    );
    // The list shown is the API's answer, fetched after the write.
    expect(await screen.findByText('Linked defects (1)')).toBeDefined();
    expect(
      await screen.findByRole('link', { name: 'Order total is wrong' }),
    ).toBeDefined();
    expect(api.calls).toContain('POST /api/test_runs/RUN-1.json/results/TC-1.json/defects');
    expect(api.calls.filter((call) => call === 'GET /api/test_runs/RUN-1.json/results/TC-1.json/defects').length).toBe(2);
    expect((screen.getByLabelText('Defect ID') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Defect URL') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Title (optional)') as HTMLInputElement).value).toBe('');
    expect(onStatus).toHaveBeenCalledWith('Linked defect 1234 to TC-1.json in RUN-1.json.');
  });

  it('omits the title when the optional field is left blank', async () => {
    const api = createStubApi([]);
    renderPanel(api);
    await screen.findByText('No defects linked to this result.');

    fireEvent.change(screen.getByLabelText('Defect ID'), { target: { value: 'PROJ-7' } });
    fireEvent.change(screen.getByLabelText('Defect URL'), {
      target: { value: 'https://acme.atlassian.net/browse/PROJ-7' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Link defect' }).closest('form')!);

    await waitFor(() =>
      expect(api.linked).toEqual([
        {
          defectId: 'PROJ-7',
          defectUrl: 'https://acme.atlassian.net/browse/PROJ-7',
          trackerType: 'jira',
        },
      ]),
    );
  });

  it('reports a refused link and keeps the list it already had', async () => {
    const api = createStubApi([defectLink()], { failLink: true });
    const { onStatus } = renderPanel(api);
    await screen.findByText('Linked defects (1)');

    fireEvent.change(screen.getByLabelText('Defect ID'), { target: { value: 'PROJ-42' } });
    fireEvent.change(screen.getByLabelText('Defect URL'), {
      target: { value: 'https://acme.atlassian.net/browse/PROJ-42' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Link defect' }).closest('form')!);

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith(
        'Could not link the defect: That defect is already linked to this result',
        'error',
      ),
    );
    expect(
      screen.getByText('Could not link the defect: That defect is already linked to this result'),
    ).toBeDefined();
    // A refused write leaves the API's list untouched.
    expect(screen.getByText('Linked defects (1)')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Unlink defect PROJ-42' })).toBeDefined();
  });

  it('unlinks a defect by its link identity and then re-reads the list', async () => {
    const api = createStubApi([defectLink()]);
    const { onStatus } = renderPanel(api);
    await screen.findByText('Linked defects (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Unlink defect PROJ-42' }));

    await waitFor(() => expect(api.unlinked).toEqual(['LINK-1']));
    expect(await screen.findByText('No defects linked to this result.')).toBeDefined();
    expect(screen.getByText('Linked defects (0)')).toBeDefined();
    expect(api.calls).toContain('DELETE /api/test_runs/RUN-1.json/results/TC-1.json/defects/LINK-1');
    expect(onStatus).toHaveBeenCalledWith('Unlinked defect PROJ-42 from TC-1.json in RUN-1.json.');
  });

  it('reports a refused unlink without dropping the link', async () => {
    const api = createStubApi([defectLink()], { failUnlink: true });
    const { onStatus } = renderPanel(api);
    await screen.findByText('Linked defects (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Unlink defect PROJ-42' }));

    await waitFor(() =>
      expect(onStatus).toHaveBeenCalledWith('Could not unlink the defect: That link is gone', 'error'),
    );
    expect(await screen.findByText('Could not unlink the defect: That link is gone')).toBeDefined();
    expect(screen.getByText('Linked defects (1)')).toBeDefined();
  });

  it('has no detectable WCAG 2.1 AA violations', async () => {
    const api = createStubApi([defectLink()]);

    const { container } = render(
      <div>
        <h4>Verify Login (TC-1.json)</h4>
        <ResultDefects
          client={api.client}
          runId="RUN-1.json"
          caseId="TC-1.json"
          onStatus={vi.fn()}
        />
      </div>,
    );
    await screen.findByText('Linked defects (1)');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
