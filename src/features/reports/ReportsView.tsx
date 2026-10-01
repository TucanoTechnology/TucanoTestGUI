import { useEffect, useState } from "react";
import type {
  CoverageReport,
  LastResultsReport,
  SummaryReport,
} from "../../api/generated/index.js";
import { apiFetch } from "../../api/client.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { useAuth } from "../../app/AuthProvider.js";
import { useProjectContext } from "../../app/ProjectContext.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { formatDurationMs, formatPercentage } from "./reportFormatters.js";

/** A filter option: the key the API addresses it by, and what to show. */
interface ReportOption {
  id: string;
  name: string;
}

function ReportLoading({ label }: { label: string }) {
  return (
    <div className="loading" role="status">
      <div className="loading__spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Counts the cases the tree holds. The report the API returns for a scope
 * echoes the project it was restricted to, so the heading states the scope the
 * payload carries rather than the one the filter asked for.
 */
function CoverageReportSection({ projectId }: { projectId: string }) {
  const { client } = useAuth();
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() =>
      client.reports.getCoverageReport(projectId ? { projectId } : {}),
    )
      .then((loaded) => {
        if (cancelled) return;
        setReport(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load the coverage report"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return (
    <section className="report" aria-labelledby="coverage-report-heading">
      <h2 id="coverage-report-heading" className="report__title">
        Coverage
      </h2>

      {loading ? (
        <ReportLoading label="Loading the coverage report…" />
      ) : error ? (
        <ApiErrorNotice error={error} />
      ) : report ? (
        <>
          <p className="report__scope">
            {report.projectId
              ? `Cases held by ${report.projectId}`
              : "Cases held by every project"}
          </p>

          <dl className="report__stats">
            <div className="report__stat">
              <dt className="report__stat-label">Total cases</dt>
              <dd className="report__stat-value">{report.totalCases}</dd>
            </div>
          </dl>

          {report.suites.length === 0 ? (
            <p className="report__note">No suite holds a case in this scope.</p>
          ) : (
            <table className="report__table">
              <caption>Cases per suite</caption>
              <thead>
                <tr>
                  <th scope="col">Suite</th>
                  <th scope="col">Suite ID</th>
                  <th scope="col">Cases</th>
                </tr>
              </thead>
              <tbody>
                {report.suites.map((suite) => (
                  <tr key={suite.suiteId}>
                    <th scope="row">{suite.name}</th>
                    <td>{suite.suiteId}</td>
                    <td>{suite.caseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="report__note">
            A case held directly by a project counts toward the total but
            belongs to no suite, so the total can exceed the sum of the rows.
          </p>
        </>
      ) : null}
    </section>
  );
}

/** How the recorded results split by status, with their pass rate. */
function SummaryReportSection({
  projectId,
  configurationId,
  milestoneId,
  from,
  to,
}: {
  projectId: string;
  configurationId: string;
  /** #183: the two filters the endpoint has always taken. */
  milestoneId: string;
  from: string;
  to: string;
}) {
  const { client } = useAuth();
  const [report, setReport] = useState<SummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() =>
      client.reports.getSummaryReport({
        ...(projectId ? { projectId } : {}),
        ...(configurationId ? { configurationId } : {}),
        ...(milestoneId ? { milestoneId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    )
      .then((loaded) => {
        if (cancelled) return;
        setReport(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load the summary report"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId, configurationId, milestoneId, from, to]);

  return (
    <section className="report" aria-labelledby="summary-report-heading">
      <h2 id="summary-report-heading" className="report__title">
        Summary
      </h2>

      {loading ? (
        <ReportLoading label="Loading the summary report…" />
      ) : error ? (
        <ApiErrorNotice error={error} />
      ) : report ? (
        <>
          <dl className="report__stats">
            <div className="report__stat">
              <dt className="report__stat-label">Total results</dt>
              <dd className="report__stat-value">{report.total}</dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Passed</dt>
              <dd className="report__stat-value">{report.passed}</dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Failed</dt>
              <dd className="report__stat-value">{report.failed}</dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Blocked</dt>
              <dd className="report__stat-value">{report.blocked}</dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Untested</dt>
              <dd className="report__stat-value">{report.untested}</dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Pass rate</dt>
              <dd className="report__stat-value">
                {formatPercentage(report.passPercentage)}
              </dd>
            </div>
            <div className="report__stat">
              <dt className="report__stat-label">Total duration</dt>
              <dd className="report__stat-value">
                {formatDurationMs(report.totalDurationMs)}
              </dd>
            </div>
          </dl>

          <p className="report__note">
            The total counts every result in scope, so it can exceed the rows
            above when a run records a status the report does not break out.
            Those results still count toward the pass rate.
          </p>
        </>
      ) : null}
    </section>
  );
}

/**
/**
 * What the latest recorded result of every covered case says right now
 * (#183): the dashboard question coverage and summary do not answer — the
 * endpoint exists precisely for it. A case no in-scope run has recorded is
 * absent rather than padded, matching the report's own contract.
 */
function LatestResultsSection({ projectId }: { projectId: string }) {
  const { client } = useAuth();
  const { setSelection } = useProjectContext();
  const [report, setReport] = useState<LastResultsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(() =>
      client.reports.getLastResultsReport(projectId ? { projectId } : {}),
    )
      .then((loaded) => {
        if (cancelled) return;
        setReport(loaded);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(readApiError(err, "Failed to load the latest results"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  return (
    <section className="report" aria-labelledby="latest-report-heading">
      <h2 id="latest-report-heading" className="report__title">
        Latest results
      </h2>

      {loading ? (
        <ReportLoading label="Loading the latest results…" />
      ) : error ? (
        <ApiErrorNotice error={error} />
      ) : report ? (
        <>
          <p className="report__scope">
            {report.projectId
              ? `The latest result each case holds in ${report.projectId}`
              : "The latest result each case holds in every project"}
          </p>
          {report.cases.length === 0 ? (
            <p className="report__note">
              No run in scope has recorded a result yet.
            </p>
          ) : (
            <table className="report__table">
              <caption>Latest result per case</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Status</th>
                  <th scope="col">Recorded</th>
                  <th scope="col">Run</th>
                </tr>
              </thead>
              <tbody>
                {report.cases.map((entry) => (
                  <tr key={entry.testCaseId}>
                    <th scope="row">{entry.testCaseId}</th>
                    <td>
                      <span
                        className={`status-badge status-badge--${entry.status.toLowerCase()}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td>{entry.timestamp}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        aria-label={`Open run ${entry.runId}`}
                        onClick={() =>
                          setSelection({
                            type: "run",
                            id: entry.runId,
                            ...(report.projectId
                              ? { projectId: report.projectId }
                              : {}),
                          })
                        }
                      >
                        {entry.runId}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}

/**
 * The reports module: read-only coverage and summary reports for a scope the
 * two filters pick. The reports are independent views of independent
 * endpoints, so each one loads, fails and re-fetches on its own.
 */
export function ReportsView() {
  const { client } = useAuth();
  const [projectId, setProjectId] = useState("");
  const [configurationId, setConfigurationId] = useState("");
  const [projects, setProjects] = useState<ReportOption[]>([]);
  const [configurations, setConfigurations] = useState<ReportOption[]>([]);
  // #183: the two remaining summary filters and the milestone offer behind
  // the third. A milestone is a project's child, so its listing follows the
  // project filter — and spans every loaded project when none is chosen.
  const [milestones, setMilestones] = useState<ReportOption[]>([]);
  const [milestoneId, setMilestoneId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [optionsError, setOptionsError] = useState<ApiErrorInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOptionsError(null);

    const loadProjects = async () => {
      const ids = await apiFetch(() => client.projects.listProjects({}));
      return Promise.all(
        ids.map(async (id) => {
          const project = await apiFetch(() =>
            client.projects.getProject({ id }),
          );
          return { id, name: project.name ?? id };
        }),
      );
    };

    loadProjects()
      .then((loaded) => {
        if (cancelled) return;
        setProjects(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptionsError(readApiError(err, "Failed to load projects"));
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  // A configuration belongs to the project that lists it, and the key the
  // project lists it under is what a run references, so the options follow the
  // project filter: with no project chosen there is no set to offer.
  useEffect(() => {
    if (projectId === "") {
      setConfigurations([]);
      return;
    }

    let cancelled = false;
    setOptionsError(null);

    const loadConfigurations = async () => {
      const ids = await apiFetch(() =>
        client.projects.listProjectConfigurations({ id: projectId }),
      );
      return Promise.all(
        ids.map(async (id) => {
          const configuration = await apiFetch(() =>
            client.configurations.getConfiguration({ id }),
          );
          return { id, name: configuration.name ?? id };
        }),
      );
    };

    loadConfigurations()
      .then((loaded) => {
        if (cancelled) return;
        setConfigurations(loaded);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptionsError(readApiError(err, "Failed to load configurations"));
      });

    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  useEffect(() => {
    if (projects.length === 0 && projectId === "") return;
    let cancelled = false;
    const sources = projectId === "" ? projects.map((p) => p.id) : [projectId];
    const load = async () => {
      const perProject = await Promise.all(
        sources.map(async (id) => {
          const ids = await apiFetch(() =>
            client.projects.listProjectMilestones({ id }),
          );
          return Promise.all(
            ids.map(async (milestoneId) => {
              const milestone = await apiFetch(() =>
                client.milestones.getMilestone({ id: milestoneId }),
              );
              return { id: milestoneId, name: milestone.name ?? milestoneId };
            }),
          );
        }),
      );
      return perProject.flat();
    };
    load()
      .then((loaded) => {
        if (!cancelled) setMilestones(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOptionsError(readApiError(err, "Failed to load milestones"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId, projects]);

  const selectProject = (value: string) => {
    setProjectId(value);
    // The configuration belongs to the project it was chosen under, so it
    // cannot survive the project changing.
    setConfigurationId("");
    setMilestoneId("");
  };

  return (
    <div className="reports">
      <div className="report-filters" role="group" aria-label="Report filters">
        <div className="report-filters__field">
          <label htmlFor="report-project-filter">Project</label>
          <select
            id="report-project-filter"
            value={projectId}
            onChange={(event) => selectProject(event.target.value)}
          >
            <option value="">Every project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="report-filters__field">
          <label htmlFor="report-configuration-filter">Configuration</label>
          <select
            id="report-configuration-filter"
            value={configurationId}
            aria-describedby="report-configuration-hint"
            disabled={projectId === ""}
            onChange={(event) => setConfigurationId(event.target.value)}
          >
            <option value="">Every configuration</option>
            {configurations.map((configuration) => (
              <option key={configuration.id} value={configuration.id}>
                {configuration.name}
              </option>
            ))}
          </select>
          <p className="report-filters__hint" id="report-configuration-hint">
            {projectId === ""
              ? "Choose a project to filter by configuration."
              : "Narrows the summary report to the runs that reference it."}
          </p>
        </div>

        <div className="report-filters__field">
          <label htmlFor="report-milestone-filter">Milestone</label>
          <select
            id="report-milestone-filter"
            value={milestoneId}
            onChange={(event) => setMilestoneId(event.target.value)}
          >
            <option value="">Every milestone</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        </div>

        {/* #183: the bounds are the run's own timestamp, inclusive and each
            independently optional — the API's rule, restated as the hint. */}
        <div className="report-filters__field">
          <label htmlFor="report-from-filter">From</label>
          <input
            id="report-from-filter"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="report-filters__field">
          <label htmlFor="report-to-filter">To</label>
          <input
            id="report-to-filter"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>

      {optionsError && <ApiErrorNotice error={optionsError} />}

      <CoverageReportSection projectId={projectId} />
      <SummaryReportSection
        projectId={projectId}
        configurationId={configurationId}
        milestoneId={milestoneId}
        from={from}
        to={to}
      />
      <LatestResultsSection projectId={projectId} />
    </div>
  );
}
