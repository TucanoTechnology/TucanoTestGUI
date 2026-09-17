import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DuplicateButton, { type DuplicableResource } from './DuplicateButton';

/**
 * Duplication must go through the generated client (issue #58), so these tests
 * assert the exact endpoint and request body each resource type reaches — the
 * hand-written client's `/api/${type}s/` pluralisation is what broke.
 */

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

interface FetchCall {
  url: string;
  method: string | undefined;
  body: string | null;
}

/** Records every request and answers with a `CreateResponse`-shaped JSON body. */
function stubFetch({
  status = 200,
  payload = { message: 'Resource created', id: 'NEW-1' },
}: { status?: number; payload?: unknown } = {}): FetchCall[] {
  const calls: FetchCall[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({
        url,
        method: init.method,
        body: typeof init.body === 'string' ? init.body : null,
      });

      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 409 ? 'Conflict' : 'OK',
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }),
  );

  return calls;
}

function openAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
}

describe('DuplicateButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const routes: [DuplicableResource, string, string][] = [
    ['project', 'PROJ-1', '/api/projects/PROJ-1/duplicate'],
    ['suite', 'SUITE-1', '/api/test_suites/SUITE-1/duplicate'],
    ['case', 'TC-1', '/api/test_cases/TC-1/duplicate'],
    ['run', 'RUN-1', '/api/test_runs/RUN-1/duplicate'],
    ['milestone', 'MS-1', '/api/milestones/MS-1/duplicate'],
  ];

  it.each(routes)('duplicates a %s through its own API route', async (resourceType, resourceId, expectedUrl) => {
    const calls = stubFetch();
    const onDuplicate = vi.fn();

    render(<DuplicateButton resourceId={resourceId} resourceType={resourceType} onDuplicate={onDuplicate} />);
    openAndConfirm();

    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith('NEW-1'));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(expectedUrl);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.body).toBe('{}');
  });

  it('asks for a specific id when one is typed and closes the field on success', async () => {
    const calls = stubFetch();
    const onDuplicate = vi.fn();

    render(<DuplicateButton resourceId="TC-1" resourceType="case" onDuplicate={onDuplicate} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    fireEvent.change(screen.getByLabelText(/new case ID/i), { target: { value: 'TC-COPY' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith('NEW-1'));

    expect(calls[0]?.body).toBe('{"newId":"TC-COPY"}');
    expect(screen.queryByLabelText(/new case ID/i)).toBeNull();
  });

  it('leaves the field open and cancels on Escape without calling the API', () => {
    const calls = stubFetch();

    render(<DuplicateButton resourceId="TC-1" resourceType="case" onDuplicate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /duplicate/i }));
    fireEvent.keyDown(screen.getByLabelText(/new case ID/i), { key: 'Escape' });

    expect(screen.queryByLabelText(/new case ID/i)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('renders the API error envelope instead of only logging it', async () => {
    stubFetch({
      status: 409,
      payload: { error: { code: 'conflict', message: 'A case with that id already exists.' } },
    });
    const onDuplicate = vi.fn();

    render(<DuplicateButton resourceId="TC-1" resourceType="case" onDuplicate={onDuplicate} />);
    openAndConfirm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not duplicate the case: A case with that id already exists.');
    expect(alert.textContent).toContain('Error code: conflict');
    expect(alert.className.split(/\s+/)).toContain('module-error');
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it('falls back to its own wording when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    render(<DuplicateButton resourceId="TC-1" resourceType="case" onDuplicate={vi.fn()} />);
    openAndConfirm();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Could not duplicate the case');
    expect(alert.textContent).toContain('Error code: network_error');
  });

  it('has no detectable WCAG 2.1 AA violations, including its error state', async () => {
    stubFetch({
      status: 409,
      payload: { error: { code: 'conflict', message: 'Already exists.' } },
    });

    const { container } = render(<DuplicateButton resourceId="PROJ-1" resourceType="project" onDuplicate={vi.fn()} />);
    openAndConfirm();
    await screen.findByRole('alert');

    const results = await axe.run(container, { runOnly: { type: 'tag', values: AXE_TAGS } });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
