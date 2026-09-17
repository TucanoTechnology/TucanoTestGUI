import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '../../api/generated';
import AttachmentsPanel, { attachmentUrl, formatFileSize } from './AttachmentsPanel';

/**
 * The attachment list belongs to the API (issue #75): there is no
 * list-attachments route, so the panel reads `GET /test_cases/{id}` and re-reads
 * it after every upload and delete. These tests therefore stub the network edge
 * — `src/api/generated/core/request.ts` calls the global `fetch` — and keep the
 * attachments on the stub, so a re-read reports what a real API would.
 */

const TEST_CASE_ID = 'TC-1.json';

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

function attachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    filename: 'shot.png',
    originalName: 'screenshot.png',
    mimeType: 'image/png',
    size: 2048,
    uploadedAt: '2026-09-17T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * A file the picker can hand over. jsdom's `Blob` has no `stream()`, which the
 * generated client's `isBlob` requires, so a bare jsdom `File` would reach the
 * multipart body as JSON — unlike every browser's. Restoring `stream` gives the
 * client the object a browser really passes it.
 */
function pickableFile(parts: string[], name: string, type: string): File {
  const file = new File(parts, name, { type });
  if (typeof (file as unknown as { stream?: unknown }).stream !== 'function') {
    Object.defineProperty(file, 'stream', { value: () => undefined, configurable: true });
  }
  return file;
}

interface ApiStub {
  requested: RecordedRequest[];
  /** What the API holds now — the panel lists whatever this returns. */
  attachments: () => Attachment[];
}

interface ApiOptions {
  initial?: Attachment[];
  failLoad?: () => Response;
  failUpload?: () => Response;
  failDelete?: () => Response;
}

/** Stands in for the API: the case document, the upload and the delete route. */
function stubApi(options: ApiOptions = {}): ApiStub {
  const state = { requested: [] as RecordedRequest[], held: options.initial ?? [] };

  const stub = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = (init?.method ?? 'GET').toUpperCase();
    state.requested.push({ method, url: urlStr, body: init?.body });

    if (method === 'GET') {
      if (options.failLoad) return options.failLoad();
      return jsonResponse({
        id: TEST_CASE_ID,
        title: 'Checkout works',
        attachments: state.held,
      });
    }

    if (method === 'POST' && urlStr.endsWith('/attachments')) {
      if (options.failUpload) return options.failUpload();
      const sent = (init?.body as FormData).get('file') as File;
      const uploaded = attachment({
        filename: sent.name,
        originalName: sent.name,
        mimeType: sent.type || 'application/octet-stream',
        size: sent.size,
        uploadedAt: undefined,
      });
      state.held = [...state.held, uploaded];
      return jsonResponse({
        message: 'uploaded',
        filename: uploaded.filename,
        originalName: uploaded.originalName,
        size: uploaded.size,
      });
    }

    if (method === 'DELETE') {
      if (options.failDelete) return options.failDelete();
      const filename = decodeURIComponent(urlStr.split('/').pop() ?? '');
      state.held = state.held.filter((item) => item.filename !== filename);
      return jsonResponse({ message: 'deleted' });
    }

    return jsonResponse({ error: { code: 'not_found', message: 'Not Found' } }, 404);
  }) as unknown as typeof fetch;

  vi.stubGlobal('fetch', stub);
  return { requested: state.requested, attachments: () => state.held };
}

function renderPanel(props: Partial<ComponentProps<typeof AttachmentsPanel>> = {}) {
  return render(<AttachmentsPanel testCaseId={TEST_CASE_ID} {...props} />);
}

function methods(requests: RecordedRequest[], method: string): RecordedRequest[] {
  return requests.filter((request) => request.method === method);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('attachment formatting', () => {
  it('renders a byte count the API reported in the unit a tester reads', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(1572864)).toBe('1.5 MB');
  });

  it('degrades to zero for a size the API did not supply', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(Number.NaN)).toBe('0 B');
    expect(formatFileSize(-1)).toBe('0 B');
  });

  it('builds the same-origin route the contract publishes, id verbatim', () => {
    expect(attachmentUrl(TEST_CASE_ID, 'shot.png')).toBe(
      '/api/test_cases/TC-1.json/attachments/shot.png',
    );
    expect(attachmentUrl(TEST_CASE_ID, 'shot one.png')).toBe(
      '/api/test_cases/TC-1.json/attachments/shot%20one.png',
    );
  });
});

describe('AttachmentsPanel', () => {
  it('lists the attachments the API reports, and hands them to its owner', async () => {
    const runLog = attachment({
      filename: 'run.log',
      originalName: 'run.log',
      mimeType: 'text/plain',
      size: 40,
      uploadedAt: '2026-09-17T11:30:00.000Z',
    });
    stubApi({ initial: [attachment(), runLog] });
    const onAttachmentsChanged = vi.fn();
    renderPanel({ onAttachmentsChanged });

    expect(await screen.findByText('screenshot.png')).toBeDefined();
    expect(screen.getByText('run.log')).toBeDefined();
    expect(screen.getByText('2.0 KB')).toBeDefined();
    expect(screen.getByText('40 B')).toBeDefined();
    expect(screen.getByText('image/png')).toBeDefined();
    expect(screen.getByText('2026-09-17T10:00:00.000Z')).toBeDefined();
    expect(screen.getByText('2026-09-17T11:30:00.000Z')).toBeDefined();
    expect(onAttachmentsChanged).toHaveBeenCalledWith([attachment(), runLog]);
  });

  it('reads the addressed case, since the list is the case document', async () => {
    const { requested } = stubApi({ initial: [attachment()] });
    renderPanel();

    await screen.findByText('screenshot.png');

    expect(methods(requested, 'GET').map((request) => request.url)).toEqual([
      `/api/test_cases/${TEST_CASE_ID}`,
    ]);
  });

  it('says so when the case carries no evidence yet', async () => {
    stubApi();
    renderPanel();

    expect(await screen.findByText('No attachments on this test case yet.')).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('surfaces a refusal to read with its envelope, and announces it', async () => {
    stubApi({
      failLoad: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    renderPanel();

    // The refusal is both announced and shown, hence the same sentence twice.
    expect(await screen.findAllByText('Could not load the attachments: Forbidden')).toHaveLength(2);
    expect(screen.getByText('Error code: forbidden')).toBeDefined();
    expect(screen.queryByText('No attachments on this test case yet.')).toBeNull();

    const status = screen.getByText(/could not load the attachments/i, {
      selector: '[aria-live]',
    });
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('uploads through the generated client and re-reads what the API holds', async () => {
    const { requested, attachments } = stubApi();
    const onAttachmentsChanged = vi.fn();
    renderPanel({ onAttachmentsChanged });
    await screen.findByText('No attachments on this test case yet.');

    const file = pickableFile(['hello evidence'], 'evidence.txt', 'text/plain');
    fireEvent.change(screen.getByLabelText('Attach a file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));

    expect(await screen.findByText('evidence.txt')).toBeDefined();
    expect(attachments().map((item) => item.filename)).toEqual(['evidence.txt']);

    const post = methods(requested, 'POST');
    expect(post).toHaveLength(1);
    expect(post[0]?.url).toBe(`/api/test_cases/${TEST_CASE_ID}/attachments`);
    const sent = (post[0]?.body as FormData).get('file') as File;
    expect(sent).toBeInstanceOf(File);
    expect(sent.name).toBe('evidence.txt');

    // The list is re-read, so a second read of the case is what filled it.
    expect(methods(requested, 'GET').length).toBe(2);
    expect(onAttachmentsChanged).toHaveBeenLastCalledWith(attachments());

    expect(screen.getByText('Uploaded evidence.txt (14 B).')).toBeDefined();
    expect((screen.getByLabelText('Attach a file') as HTMLInputElement).value).toBe('');
  });

  it('reports a refused upload with its envelope and keeps the list', async () => {
    stubApi({
      initial: [attachment()],
      failUpload: () => jsonResponse({ error: { code: 'missing_file', message: 'No file' } }, 400),
    });
    renderPanel();
    await screen.findByText('screenshot.png');

    const file = pickableFile(['hello'], 'evidence.txt', 'text/plain');
    fireEvent.change(screen.getByLabelText('Attach a file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload attachment' }));

    expect(await screen.findByText('Error code: missing_file')).toBeDefined();
    expect(
      screen.getByText('Could not upload evidence.txt: No file', { selector: '[aria-live]' }),
    ).toBeDefined();
    expect(screen.getByText('screenshot.png')).toBeDefined();
  });

  it('deletes only after the confirmation, then re-reads the case', async () => {
    const { requested, attachments } = stubApi({ initial: [attachment()] });
    renderPanel();
    await screen.findByText('screenshot.png');

    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot.png' }));
    expect(screen.getByText('Delete screenshot.png? This cannot be undone.')).toBeDefined();
    expect(methods(requested, 'DELETE')).toHaveLength(0);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByText('No attachments on this test case yet.')).toBeDefined();
    expect(attachments()).toEqual([]);
    expect(methods(requested, 'DELETE').map((request) => request.url)).toEqual([
      `/api/test_cases/${TEST_CASE_ID}/attachments/shot.png`,
    ]);
    expect(methods(requested, 'GET').length).toBe(2);
    expect(screen.getByText('Deleted screenshot.png.', { selector: '[aria-live]' })).toBeDefined();
    expect(screen.queryByText('Delete screenshot.png? This cannot be undone.')).toBeNull();
  });

  it('leaves the evidence alone when the confirmation is dismissed', async () => {
    const { requested } = stubApi({ initial: [attachment()] });
    renderPanel();
    await screen.findByText('screenshot.png');

    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete screenshot.png? This cannot be undone.')).toBeNull();
    expect(screen.getByText('screenshot.png')).toBeDefined();
    expect(methods(requested, 'DELETE')).toHaveLength(0);
  });

  it('reports a refused delete with its envelope', async () => {
    stubApi({
      initial: [attachment()],
      failDelete: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    renderPanel();
    await screen.findByText('screenshot.png');

    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot.png' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    expect(await screen.findByText('Error code: forbidden')).toBeDefined();
    expect(
      screen.getByText('Could not delete screenshot.png: Forbidden', { selector: '[aria-live]' }),
    ).toBeDefined();
    expect(screen.getByText('screenshot.png')).toBeDefined();
  });

  it('previews an image through the same-origin route and saves it by link', async () => {
    stubApi({ initial: [attachment()] });
    renderPanel();
    await screen.findByText('screenshot.png');

    const save = screen.getByRole('link', { name: 'Save screenshot.png' });
    expect(save.getAttribute('href')).toBe(
      `/api/test_cases/${TEST_CASE_ID}/attachments/shot.png`,
    );
    expect(save.getAttribute('download')).toBe('screenshot.png');
    expect(screen.queryByAltText('Attachment preview: screenshot.png')).toBeNull();

    const preview = screen.getByRole('button', { name: 'Preview screenshot.png' });
    fireEvent.click(preview);

    const image = screen.getByAltText('Attachment preview: screenshot.png');
    expect(image.getAttribute('src')).toBe(`/api/test_cases/${TEST_CASE_ID}/attachments/shot.png`);
    expect(preview.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(preview);
    expect(screen.queryByAltText('Attachment preview: screenshot.png')).toBeNull();
    expect(preview.getAttribute('aria-expanded')).toBe('false');
  });

  it('says an attachment has no inline preview when it is not an image', async () => {
    stubApi({
      initial: [attachment({ filename: 'run.log', originalName: 'run.log', mimeType: 'text/plain' })],
    });
    renderPanel();
    await screen.findByText('run.log');

    fireEvent.click(screen.getByRole('button', { name: 'Preview run.log' }));

    expect(screen.getByText('text/plain has no inline preview. Save it to open it.')).toBeDefined();
    expect(screen.queryByAltText('Attachment preview: run.log')).toBeNull();
  });

  it('has no detectable WCAG 2.1 AA violations', async () => {
    stubApi({ initial: [attachment()] });
    const { container } = renderPanel();
    await screen.findByText('screenshot.png');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations when the case cannot be read', async () => {
    stubApi({
      failLoad: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    const { container } = renderPanel();
    await screen.findAllByText('Could not load the attachments: Forbidden');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations while a delete is confirmed', async () => {
    stubApi({ initial: [attachment()] });
    const { container } = renderPanel();
    await screen.findByText('screenshot.png');

    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot.png' }));
    expect(screen.getByText('Delete screenshot.png? This cannot be undone.')).toBeDefined();

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
