import { fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '../api/generated';
import DetailView from './DetailView';

/**
 * The detail pane hands a test case's evidence to the panel, which reads the
 * case document itself (issue #75). Both go through the network edge, so this
 * stubs `fetch` once and serves the case and suite documents from it.
 */

const CASE_ID = 'TC-1.json';
const SUITE_ID = 'regression.json';

interface RecordedRequest {
  method: string;
  url: string;
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

function stubApi(attachments: Attachment[] = [attachment()]): RecordedRequest[] {
  const requested: RecordedRequest[] = [];

  const stub = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    requested.push({ method: (init?.method ?? 'GET').toUpperCase(), url: urlStr });

    if (urlStr.startsWith(`/api/test_cases/${CASE_ID}`)) {
      return jsonResponse({
        testCaseId: CASE_ID,
        title: 'Checkout works',
        attachments,
      });
    }

    if (urlStr.startsWith(`/api/test_suites/${SUITE_ID}`)) {
      return jsonResponse({ testSuiteId: SUITE_ID, title: 'Regression', testCases: [] });
    }

    return jsonResponse({ error: { code: 'not_found', message: 'Not Found' } }, 404);
  }) as unknown as typeof fetch;

  vi.stubGlobal('fetch', stub);
  return requested;
}

function renderDetail(props: Partial<ComponentProps<typeof DetailView>> = {}) {
  return render(
    <DetailView itemId={CASE_ID} itemType="case" onClose={() => {}} {...props} />,
  );
}

/** The case-document reads that went out — the pane's own and the panel's. */
function caseReads(requested: RecordedRequest[]): RecordedRequest[] {
  return requested.filter(
    (request) => request.method === 'GET' && request.url === `/api/test_cases/${CASE_ID}`,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DetailView attachments tab', () => {
  it('counts the evidence a case holds and opens the panel that owns it', async () => {
    const requested = stubApi([
      attachment(),
      attachment({
        filename: 'run.log',
        originalName: 'run.log',
        mimeType: 'text/plain',
        size: 40,
        uploadedAt: '2026-09-17T11:30:00.000Z',
      }),
    ]);
    renderDetail();

    const tab = await screen.findByRole('button', { name: 'Attachments (2)' });
    fireEvent.click(tab);

    expect(await screen.findByText('screenshot.png')).toBeDefined();
    expect(screen.getByText('run.log')).toBeDefined();
    // The panel re-reads the case document rather than trusting the pane's copy.
    expect(caseReads(requested).length).toBe(2);
  });

  it('shows an empty list when the case carries none', async () => {
    stubApi([]);
    renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Attachments (0)' }));

    expect(await screen.findByText('No attachments on this test case yet.')).toBeDefined();
  });

  it('points a non-case owner at test cases instead', async () => {
    const requested = stubApi();
    renderDetail({ itemId: SUITE_ID, itemType: 'suite' });

    fireEvent.click(await screen.findByRole('button', { name: 'Attachments (0)' }));

    expect(await screen.findByText('Attachments belong to test cases.')).toBeDefined();
    expect(screen.queryByText('No attachments on this test case yet.')).toBeNull();
    expect(caseReads(requested)).toHaveLength(0);
  });

  it('has no detectable WCAG 2.1 AA violations with the evidence open', async () => {
    stubApi();
    const { container } = renderDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Attachments (1)' }));
    await screen.findByText('screenshot.png');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
