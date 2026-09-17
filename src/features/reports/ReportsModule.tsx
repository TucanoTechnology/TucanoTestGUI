import { useEffect, useId, useMemo, useState } from 'react';
import { apiErrorEnvelope, createApiClient, type ApiErrorEnvelope } from '../../api/configure';
import type { CoverageReport, SummaryReport, TucanoApi } from '../../api/generated';

/**
 * Reports view (issue #56): coverage and summary.
 *
 * Every number below is answered by the API through the generated client
 * (`GET /reports/coverage` and `GET /reports/summary`); the project the shell
 * selected is passed through as the one filter, and the GUI only formats what
 * comes back. Nothing is counted here.
 */

type SectionState = 'loading' | 'ready' | 'error';

const API_UNREACHABLE = 'the API could not be reached.';

/** The API answers a percentage; the view only fixes its precision. */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** `3m 12s` — the API's milliseconds turned into the duration a tester reads. */
export function formatDuration(totalMs: number): string {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return '0s';
  if (totalMs < 1000) return `${Math.round(totalMs)}ms`;

  const totalSeconds = Math.round(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (hours > 0 || minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

/** The API echoes the scope it used; until it answers, the selection stands in. */
export function scopeLabel(projectId: string | undefined): string {
  return projectId ? `Scoped to project ${projectId}` : 'All projects';
}

export interface ReportsModuleProps {
  /** The project the shell selected; omitted, the reports cover every project. */
  projectId?: string;
}

interface ReportSection<T> {
  state: SectionState;
  report: T | null;
  failure: ApiErrorEnvelope | null;
}

/** Each panel loads on its own, so one refusal leaves the other readable. */
function useReport<T>(
  load: (api: TucanoApi, projectId: string | undefined) => Promise<T>,
  api: TucanoApi,
  projectId: string | undefined,
): ReportSection<T> {
  const [state, setState] = useState<SectionState>('loading');
  const [report, setReport] = useState<T | null>(null);
  const [failure, setFailure] = useState<ApiErrorEnvelope | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setFailure(null);

    void (async () => {
      try {
        const value = await load(api, projectId);
        if (cancelled) return;
        setReport(value);
        setState('ready');
      } catch (error) {
        if (cancelled) return;
        setReport(null);
        setFailure(apiErrorEnvelope(error));
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, projectId, load]);

  return { state, report, failure };
}

const loadCoverage = (api: TucanoApi, projectId: string | undefined) =>
  api.reports.getCoverageReport({ projectId });

const loadSummary = (api: TucanoApi, projectId: string | undefined) =>
  api.reports.getSummaryReport({ projectId });

/** Announcements are sentences: the panels' refusals are never colour alone. */
function announcementFor(
  section: string,
  state: SectionState,
  failure: ApiErrorEnvelope | null,
): string | null {
  if (state === 'loading') return `Loading the ${section} report…`;
  if (state === 'error') {
    return `Could not load the ${section} report: ${failure?.message ?? API_UNREACHABLE}`;
  }
  return null;
}

function ErrorBlock({
  section,
  failure,
}: {
  section: string;
  failure: ApiErrorEnvelope | null;
}) {
  return (
    <div className="module-error">
      <p>
        Could not load the {section} report: {failure?.message ?? API_UNREACHABLE}
      </p>
      <p className="module-error-code">Error code: {failure?.code ?? 'network_error'}</p>
    </div>
  );
}

export default function ReportsModule({ projectId }: ReportsModuleProps) {
  const api = useMemo(() => createApiClient(), []);
  const coverage = useReport<CoverageReport>(loadCoverage, api, projectId);
  const summary = useReport<SummaryReport>(loadSummary, api, projectId);
  const headingId = useId();

  const announcement = [
    announcementFor('coverage', coverage.state, coverage.failure),
    announcementFor('summary', summary.state, summary.failure),
  ]
    .filter((text): text is string => text !== null)
    .join(' ');

  // The API echoes the project only when the report was scoped to one.
  const scope = scopeLabel(coverage.report?.projectId ?? projectId);

  return (
    <>
      <section className="panel-column is-divided" aria-labelledby={`${headingId}-coverage`}>
        <div className="panel-header">
          <h2 id={`${headingId}-coverage`}>Coverage</h2>
        </div>

        <p className="status-bar-announcement" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        {coverage.state === 'loading' && (
          <p className="module-state">Fetching the coverage report…</p>
        )}

        {coverage.state === 'error' && (
          <div className="table-scroll">
            <ErrorBlock section="coverage" failure={coverage.failure} />
          </div>
        )}

        {coverage.state === 'ready' && coverage.report && (
          <>
            <div className="table-toolbar">
              <span className="table-toolbar-group">{scope}</span>
              <span className="badge badge-md">Total cases: {coverage.report.totalCases}</span>
            </div>

            {coverage.report.suites.length === 0 ? (
              <p className="module-state">No suites hold cases in this scope.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <caption className="module-state">
                    Cases per suite. A case held directly by a project counts toward the
                    total but appears in no suite.
                  </caption>
                  <thead>
                    <tr className="data-table-head-row">
                      <th>Suite</th>
                      <th>Suite ID</th>
                      <th>Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.report.suites.map((suite) => (
                      <tr key={suite.suiteId}>
                        <td className="data-table-cell">{suite.name || suite.suiteId}</td>
                        <td className="data-table-cell is-id">{suite.suiteId}</td>
                        <td className="data-table-cell">{suite.caseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      <section className="panel-column" aria-labelledby={`${headingId}-summary`}>
        <div className="panel-header">
          <h2 id={`${headingId}-summary`}>Summary</h2>
        </div>

        {summary.state === 'loading' && (
          <p className="module-state">Fetching the summary report…</p>
        )}

        {summary.state === 'error' && (
          <div className="table-scroll">
            <ErrorBlock section="summary" failure={summary.failure} />
          </div>
        )}

        {summary.state === 'ready' && summary.report && (
          <>
            <div className="table-toolbar">
              <span className="table-toolbar-group">{scope}</span>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <caption className="module-state">
                  Recorded results across the runs in scope. `Total` counts every result,
                  so it can exceed the named buckets when a run records `Retest`.
                </caption>
                <thead>
                  <tr className="data-table-head-row">
                    <th>Result</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="data-table-cell">Total</td>
                    <td className="data-table-cell">{summary.report.total}</td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Passed</td>
                    <td className="data-table-cell">{summary.report.passed}</td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Failed</td>
                    <td className="data-table-cell">{summary.report.failed}</td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Blocked</td>
                    <td className="data-table-cell">{summary.report.blocked}</td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Untested</td>
                    <td className="data-table-cell">{summary.report.untested}</td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Pass rate</td>
                    <td className="data-table-cell">
                      {formatPercentage(summary.report.passPercentage)}
                    </td>
                  </tr>
                  <tr>
                    <td className="data-table-cell">Total duration</td>
                    <td className="data-table-cell">
                      {formatDuration(summary.report.totalDurationMs)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
