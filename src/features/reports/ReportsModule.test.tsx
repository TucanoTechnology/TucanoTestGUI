import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReportsModule, { formatDuration, formatPercentage, scopeLabel } from './ReportsModule';

/**
 * The reports are answered by the API (issue #56), so these tests stub the
 * network edge rather than the client: `src/api/generated/core/request.ts`
 * calls the global `fetch`, which means the real service, URL builder and error
 * envelope are all exercised, and the requests the view made can be asserted on.
 */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** What the API answers for `/reports/coverage` and `/reports/summary`. */
interface ReportRoutes {
  coverage?: () => Response;
  summary?: () => Response;
}

function stubReportRoutes(routes: ReportRoutes): { requested: string[] } {
  const requested: string[] = [];
  const stub = (async (url: string) => {
    const urlStr = String(url);
    requested.push(urlStr);
    if (urlStr.includes('/reports/coverage') && routes.coverage) return routes.coverage();
    if (urlStr.includes('/reports/summary') && routes.summary) return routes.summary();
    return jsonResponse({ error: { code: 'not_found', message: 'Not Found' } }, 404);
  }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', stub);
  return { requested };
}

const COVERAGE = {
  projectId: 'PROJ-1.json',
  totalCases: 20,
  suites: [
    { suiteId: 'SmokeTest.json', name: 'Smoke Test', caseCount: 4 },
    { suiteId: 'Checkout.json', name: 'Checkout', caseCount: 3 },
  ],
};

const SUMMARY = {
  total: 20,
  passed: 16,
  failed: 2,
  blocked: 1,
  untested: 1,
  passPercentage: 80,
  totalDurationMs: 192000,
};

function ready(): ReportRoutes {
  return {
    coverage: () => jsonResponse(COVERAGE),
    summary: () => jsonResponse(SUMMARY),
  };
}

/** The value in the summary table's row named `label`. */
function summaryValue(label: string): string {
  const row = screen.getByRole('cell', { name: label }).closest('tr');
  if (!row) throw new Error(`no summary row named ${label}`);
  return row.cells[1]?.textContent ?? '';
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('report formatting', () => {
  it('renders a percentage the API answered at one decimal', () => {
    expect(formatPercentage(80)).toBe('80.0%');
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(69.230769)).toBe('69.2%');
  });

  it('renders a duration a tester can read', () => {
    expect(formatDuration(192000)).toBe('3m 12s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(3661000)).toBe('1h 1m 1s');
  });

  it('degrades to zero for a duration the API did not supply', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(Number.NaN)).toBe('0s');
    expect(formatDuration(-10)).toBe('0s');
  });

  it('names the scope the API reported', () => {
    expect(scopeLabel('PROJ-1.json')).toBe('Scoped to project PROJ-1.json');
    expect(scopeLabel(undefined)).toBe('All projects');
  });
});

describe('ReportsModule', () => {
  it('shows the coverage and the summary the API answered', async () => {
    stubReportRoutes(ready());
    render(<ReportsModule projectId="PROJ-1.json" />);

    expect(await screen.findByRole('cell', { name: 'Smoke Test' })).toBeDefined();
    expect(screen.getByRole('cell', { name: 'SmokeTest.json' })).toBeDefined();
    expect(screen.getByText('Total cases: 20')).toBeDefined();
    expect(screen.getAllByText('Scoped to project PROJ-1.json').length).toBe(2);

    expect(summaryValue('Total')).toBe('20');
    expect(summaryValue('Passed')).toBe('16');
    expect(summaryValue('Failed')).toBe('2');
    expect(summaryValue('Blocked')).toBe('1');
    expect(summaryValue('Untested')).toBe('1');
    expect(summaryValue('Pass rate')).toBe('80.0%');
    expect(summaryValue('Total duration')).toBe('3m 12s');
  });

  it('asks the API for both reports, scoped to the selected project', async () => {
    const { requested } = stubReportRoutes(ready());
    render(<ReportsModule projectId="PROJ-1.json" />);

    await screen.findByRole('cell', { name: 'Smoke Test' });

    expect(requested).toContain('/api/reports/coverage?projectId=PROJ-1.json');
    expect(requested).toContain('/api/reports/summary?projectId=PROJ-1.json');
  });

  it('asks for every project when the shell selected none', async () => {
    // A global report echoes no project, so the scope is every project.
    const { requested } = stubReportRoutes({
      coverage: () => jsonResponse({ totalCases: 20, suites: COVERAGE.suites }),
      summary: () => jsonResponse(SUMMARY),
    });
    render(<ReportsModule />);

    expect(await screen.findByRole('cell', { name: 'Smoke Test' })).toBeDefined();
    expect(requested).toContain('/api/reports/coverage');
    expect(requested).toContain('/api/reports/summary');
    expect(screen.getAllByText('All projects').length).toBe(2);
  });

  it('announces loading through a live region before the reports arrive', () => {
    stubReportRoutes(ready());
    render(<ReportsModule />);

    const status = screen.getByText(/loading the coverage report/i);
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toMatch(/loading the summary report/i);
  });

  it('falls back to the selection when the global report echoes no project', async () => {
    stubReportRoutes({
      coverage: () => jsonResponse({ totalCases: 20, suites: [] }),
      summary: () => jsonResponse(SUMMARY),
    });
    render(<ReportsModule projectId="PROJ-1.json" />);

    expect(await screen.findByText('Total cases: 20')).toBeDefined();
    expect(screen.getAllByText('Scoped to project PROJ-1.json').length).toBe(2);
  });

  it('states it when no suite holds cases in scope', async () => {
    stubReportRoutes({
      coverage: () => jsonResponse({ projectId: 'PROJ-1.json', totalCases: 2, suites: [] }),
      summary: () => jsonResponse(SUMMARY),
    });
    render(<ReportsModule projectId="PROJ-1.json" />);

    expect(await screen.findByText('No suites hold cases in this scope.')).toBeDefined();
    expect(screen.getByText('Total cases: 2')).toBeDefined();
  });

  it('reports a refusal with its envelope and keeps the other panel readable', async () => {
    stubReportRoutes({
      coverage: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
      summary: () => jsonResponse(SUMMARY),
    });
    render(<ReportsModule projectId="PROJ-1.json" />);

    // The refusal is both announced and shown, hence the same sentence twice.
    expect(
      await screen.findAllByText('Could not load the coverage report: Forbidden'),
    ).toHaveLength(2);
    expect(screen.getByText('Error code: forbidden')).toBeDefined();
    expect(summaryValue('Pass rate')).toBe('80.0%');
    expect(screen.queryByText('Total cases: 20')).toBeNull();
  });

  it('announces the refusal through the live region', async () => {
    stubReportRoutes({
      coverage: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
      summary: () => jsonResponse(SUMMARY),
    });
    render(<ReportsModule projectId="PROJ-1.json" />);

    const status = await screen.findByText(/could not load the coverage report/i, {
      selector: '[aria-live]',
    });
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('has no detectable WCAG 2.1 AA violations', async () => {
    stubReportRoutes(ready());
    const { container } = render(<ReportsModule projectId="PROJ-1.json" />);
    await screen.findByRole('cell', { name: 'Smoke Test' });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('has no detectable WCAG 2.1 AA violations when a report is refused', async () => {
    stubReportRoutes({
      coverage: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
      summary: () => jsonResponse({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
    });
    const { container } = render(<ReportsModule />);
    await screen.findAllByText('Error code: forbidden');

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
