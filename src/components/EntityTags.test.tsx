import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntityTags, { formatTags, parseTags, type TaggedItemType } from './EntityTags';

/**
 * Tags belong to the API (issue #62): the control reads the entity document and
 * re-reads it after every write, so these tests stub the network edge — the
 * generated client calls the global `fetch` — and keep the tags on the stub, so
 * a re-read reports what a real API would hold.
 */

interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface Entity {
  type: TaggedItemType;
  /** The id the API publishes, substituted into the route verbatim. */
  id: string;
  /** The route under the proxy path, where the entity is read and written. */
  url: string;
  label: string;
}

const CASE: Entity = {
  type: 'case',
  id: 'TC-1.json',
  url: '/api/test_cases/TC-1.json',
  label: 'test case',
};

const ENTITIES: Entity[] = [
  CASE,
  {
    type: 'suite',
    id: 'regression.json',
    url: '/api/test_suites/regression.json',
    label: 'test suite',
  },
  { type: 'project', id: 'checkout', url: '/api/projects/checkout', label: 'project' },
  { type: 'run', id: 'RUN-9.json', url: '/api/test_runs/RUN-9.json', label: 'test run' },
];

interface ApiStub {
  requested: RecordedRequest[];
  /** What the API holds now — the control renders whatever this returns. */
  tagsOf: (type: TaggedItemType) => string[] | undefined;
}

interface ApiOptions {
  /**
   * The tags each entity starts with. A type left out has no `tags` field at
   * all, which is what the contract publishes for an entity nobody tagged.
   */
  initial?: Record<string, string[]>;
  failLoad?: () => Response;
  failSave?: () => Response;
}

/** Stands in for the API: one entity document per type, read and written. */
function stubApi(options: ApiOptions = {}): ApiStub {
  const held: Record<string, string[] | undefined> = { ...options.initial };
  const requested: RecordedRequest[] = [];

  const stub = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    requested.push({
      method,
      url: urlStr,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });

    const entity = ENTITIES.find((candidate) => candidate.url === urlStr);
    if (entity === undefined) {
      return jsonResponse({ error: { code: 'not_found', message: 'Not Found' } }, 404);
    }

    if (method === 'GET') {
      if (options.failLoad) return options.failLoad();
      const tags = held[entity.type];
      return jsonResponse({
        id: entity.id,
        title: entity.label,
        ...(tags === undefined ? {} : { tags }),
      });
    }

    if (method === 'PUT') {
      if (options.failSave) return options.failSave();
      const sent = JSON.parse(String(init?.body)) as { tags?: string[] };
      held[entity.type] = sent.tags ?? [];
      // The update answers with a message only, as the contract publishes it.
      return jsonResponse({ message: 'updated' });
    }

    return jsonResponse({ error: { code: 'not_found', message: 'Not Found' } }, 404);
  }) as unknown as typeof fetch;

  vi.stubGlobal('fetch', stub);
  return { requested, tagsOf: (type) => held[type] };
}

function renderTags(type: TaggedItemType = 'case', id: string = CASE.id) {
  return render(<EntityTags resourceType={type} resourceId={id} />);
}

function methods(requests: RecordedRequest[], method: string): RecordedRequest[] {
  return requests.filter((request) => request.method === method);
}

function announcement(): HTMLElement {
  return screen.getByText(/./, { selector: '[aria-live]' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tag formatting', () => {
  it('reads the comma-separated form the contract asks for', () => {
    expect(parseTags('smoke, regression')).toEqual(['smoke', 'regression']);
    expect(parseTags('  smoke ,  regression  ')).toEqual(['smoke', 'regression']);
  });

  it('drops blanks and keeps a repeated tag once, in the order given', () => {
    expect(parseTags('')).toEqual([]);
    expect(parseTags('   ')).toEqual([]);
    expect(parseTags(', smoke ,, ')).toEqual(['smoke']);
    expect(parseTags('smoke, smoke,regression,smoke')).toEqual(['smoke', 'regression']);
  });

  it('writes the array the API reported back into that form', () => {
    expect(formatTags(['smoke', 'regression'])).toBe('smoke, regression');
    expect(formatTags([])).toBe('');
    expect(formatTags(undefined)).toBe('');
  });
});

describe('EntityTags', () => {
  it('renders a chip per tag the API reported, and offers them for editing', async () => {
    stubApi({ initial: { case: ['smoke', 'regression'] } });
    renderTags();

    expect(await screen.findByText('smoke')).toBeDefined();
    expect(screen.getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'smoke',
      'regression',
    ]);
    expect(screen.getByRole('heading', { name: 'Tags' })).toBeDefined();
    expect((screen.getByLabelText('Tags (comma-separated)') as HTMLInputElement).value).toBe(
      'smoke, regression',
    );
    expect(announcement().textContent).toBe('Loaded 2 tags.');
  });

  it('announces a single tag in the singular', async () => {
    stubApi({ initial: { case: ['smoke'] } });
    renderTags();

    expect(await screen.findByText('smoke')).toBeDefined();
    expect(announcement().textContent).toBe('Loaded 1 tag.');
  });

  it('says an entity carries none, rather than failing, when the contract omits the field', async () => {
    stubApi();
    renderTags();

    expect(await screen.findByText('No tags')).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText(/could not load/i)).toBeNull();
    expect(announcement().textContent).toBe('Loaded 0 tags.');
  });

  it('treats an empty list the same way', async () => {
    stubApi({ initial: { case: [] } });
    renderTags();

    expect(await screen.findByText('No tags')).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('saves through the generated client, then re-reads what the API holds', async () => {
    const { requested, tagsOf } = stubApi({ initial: { case: ['smoke'] } });
    renderTags();
    await screen.findByText('smoke');

    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'regression, smoke , regression' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save tags' }));

    expect(await screen.findByText('regression')).toBeDefined();
    expect(tagsOf('case')).toEqual(['regression', 'smoke']);
    expect(screen.getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
      'regression',
      'smoke',
    ]);
    // The input is re-synced from the API's list, so a duplicate is not echoed.
    expect((screen.getByLabelText('Tags (comma-separated)') as HTMLInputElement).value).toBe(
      'regression, smoke',
    );

    const put = methods(requested, 'PUT');
    expect(put).toHaveLength(1);
    expect(put[0]?.url).toBe('/api/test_cases/TC-1.json');
    // A partial update: only the tags are sent, so the API keeps every other field.
    expect(put[0]?.body).toEqual({ tags: ['regression', 'smoke'] });

    // The write is followed by a read, so the chips show what the API holds.
    expect(methods(requested, 'GET').map((request) => request.url)).toEqual([
      '/api/test_cases/TC-1.json',
      '/api/test_cases/TC-1.json',
    ]);
    expect(announcement().textContent).toBe('Saved 2 tags.');
  });

  it('clears every tag when the input is emptied', async () => {
    const { requested, tagsOf } = stubApi({ initial: { case: ['smoke', 'regression'] } });
    renderTags();
    await screen.findByText('smoke');

    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save tags' }));

    expect(await screen.findByText('No tags')).toBeDefined();
    expect(tagsOf('case')).toEqual([]);
    expect(methods(requested, 'PUT')[0]?.body).toEqual({ tags: [] });
    expect(announcement().textContent).toBe('Saved 0 tags.');
  });

  for (const entity of ENTITIES) {
    it(`reads and writes a ${entity.label} through its own route`, async () => {
      const { requested, tagsOf } = stubApi({ initial: { [entity.type]: ['smoke'] } });
      renderTags(entity.type, entity.id);
      await screen.findByText('smoke');

      fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
        target: { value: 'fast' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save tags' }));

      expect(await screen.findByText('fast')).toBeDefined();
      expect(tagsOf(entity.type)).toEqual(['fast']);
      expect(requested.map((request) => `${request.method} ${request.url}`)).toEqual([
        `GET ${entity.url}`,
        `PUT ${entity.url}`,
        `GET ${entity.url}`,
      ]);
    });
  }

  it('surfaces a refusal to read with its envelope, and announces it', async () => {
    stubApi({
      failLoad: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    renderTags();

    // The refusal is both announced and shown, hence the same sentence twice.
    expect(await screen.findAllByText('Could not load the tags: Forbidden')).toHaveLength(2);
    expect(screen.getByText('Error code: forbidden')).toBeDefined();
    expect(screen.queryByText('No tags')).toBeNull();
    expect(screen.queryByLabelText('Tags (comma-separated)')).toBeNull();

    expect(announcement().getAttribute('aria-live')).toBe('polite');
  });

  it('renders its own wording when a failure carried no envelope', async () => {
    stubApi({ failLoad: () => new Response('boom', { status: 500 }) });
    renderTags();

    expect(await screen.findByText('Error code: network_error')).toBeDefined();
    expect(screen.getAllByText('Could not load the tags: the API could not be reached.')).toHaveLength(
      2,
    );
  });

  it('reports a refused save with its envelope and keeps the tags it had', async () => {
    const { requested, tagsOf } = stubApi({
      initial: { case: ['smoke'] },
      failSave: () =>
        jsonResponse({ error: { code: 'unknown_fields', message: 'Unknown fields are rejected' } }, 400),
    });
    renderTags();
    await screen.findByText('smoke');

    fireEvent.change(screen.getByLabelText('Tags (comma-separated)'), {
      target: { value: 'fast' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save tags' }));

    expect(await screen.findByText('Error code: unknown_fields')).toBeDefined();
    expect(screen.getByText('Unknown fields are rejected')).toBeDefined();
    expect(announcement().textContent).toBe(
      'Could not save the tags: Unknown fields are rejected',
    );
    // The write never landed, so the chips still show what the API holds.
    expect(tagsOf('case')).toEqual(['smoke']);
    expect(screen.getByText('smoke')).toBeDefined();
    expect(screen.queryByText('fast')).toBeNull();
    expect(methods(requested, 'GET').map((request) => request.url)).toEqual([
      '/api/test_cases/TC-1.json',
    ]);
  });

  it('has no detectable WCAG 2.1 AA violations with the tags showing', async () => {
    stubApi({ initial: { case: ['smoke', 'regression'] } });
    const { container } = renderTags();
    await screen.findByText('smoke');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations when the entity carries none', async () => {
    stubApi();
    const { container } = renderTags();
    await screen.findByText('No tags');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations when the tags cannot be read', async () => {
    stubApi({
      failLoad: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    const { container } = renderTags();
    await screen.findAllByText('Could not load the tags: Forbidden');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
