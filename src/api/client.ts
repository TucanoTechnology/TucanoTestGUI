// Every read and write goes through the API. The GUI holds no server-side state,
// so replicas scale independently of the API tier.

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = error.code;
  }
}

export interface Attachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt?: string;
}

/**
 * The result vocabulary, mirroring `TestCaseResult.status` and
 * `TestResultRequest.status` in api/openapi.json. A status describes one
 * execution of one case and therefore belongs to a test run, never to the case
 * document (issue #65).
 */
export const TEST_RESULT_STATUSES = ['Passed', 'Failed', 'Blocked', 'Untested', 'Retest'] as const;
export type TestResultStatus = (typeof TEST_RESULT_STATUSES)[number];

/** Mirrors `TestCase.priority`; independent of both status and severity. */
export const TEST_CASE_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export type TestCasePriority = (typeof TEST_CASE_PRIORITIES)[number];

/** Mirrors `TestCase.severity`; independent of both status and priority. */
export const TEST_CASE_SEVERITIES = ['Trivial', 'Minor', 'Major', 'Critical'] as const;
export type TestCaseSeverity = (typeof TEST_CASE_SEVERITIES)[number];

export interface TestCase {
  testCaseId: string;
  title: string;
  description?: string;
  steps?: string[];
  expectedResult: string;
  priority?: TestCasePriority;
  severity?: TestCaseSeverity;
  exploratory?: boolean;
  attachments?: Attachment[];
}

/** One case's outcome inside a run; mirrors `TestCaseResult` in the contract. */
export interface TestCaseResult {
  testCaseId?: string;
  status?: TestResultStatus;
  timestamp?: string;
  notes?: string;
  durationMs?: number;
  attachments?: Attachment[];
  defectLinks?: string[];
}

export interface TestResultInput {
  testCaseId: string;
  status: TestResultStatus;
  notes?: string;
}

/** Mirrors `DefectLink.trackerType`; the only four trackers the API knows. */
export const DEFECT_TRACKER_TYPES = ['jira', 'github', 'gitlab', 'custom'] as const;
export type DefectTrackerType = (typeof DEFECT_TRACKER_TYPES)[number];

/**
 * A defect a run result points at; mirrors `DefectLink` in the contract.
 * `linkId` is the link's own identity, which is why unlinking takes it rather
 * than the defect's position in the list.
 */
export interface DefectLink {
  linkId: string;
  defectId: string;
  defectUrl: string;
  trackerType: DefectTrackerType;
  title?: string;
  status?: string;
  linkedAt: string;
}

/**
 * The client-supplied half of a defect link; mirrors `DefectLinkRequest`. The
 * API derives `linkId` and `linkedAt` and rejects a body that carries either,
 * so neither appears here.
 */
export interface DefectLinkInput {
  defectId: string;
  defectUrl: string;
  trackerType: DefectTrackerType;
  title?: string;
}

export interface TestSuite {
  suiteId: string;
  name: string;
  description?: string;
  testCases: TestCase[];
}

export interface Project {
  projectId: string;
  name: string;
  description?: string;
  testSuites: TestSuite[];
}

export interface TestRun {
  testRunId: string;
  timestamp: string;
  projects?: Project[];
  testSuites?: TestSuite[];
  testCases?: TestCase[];
  /** Run-scoped outcomes; the only place a case status is recorded. */
  results?: TestCaseResult[];
}

export interface Milestone {
  milestoneId: string;
  name: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  status?: string;
  testSuiteIds?: string[];
  testRunIds?: string[];
}

export interface MilestoneProgress {
  milestoneId: string;
  totalCases: number;
  passed: number;
  failed: number;
  blocked: number;
  untested: number;
  retest: number;
  passPercentage: number;
}

export interface ListQuery {
  /** Case-insensitive substring match applied to returned identifiers. */
  filter?: string;
}

const DEFAULT_BASE_URL = '/api';

function resolveBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL;
  return typeof configured === 'string' && configured.length > 0
    ? configured.replace(/\/$/, '')
    : DEFAULT_BASE_URL;
}

export class TucanoApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(baseUrl: string = resolveBaseUrl(), fetchImpl: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl.call(globalThis, `${this.baseUrl}${path}`, {
      headers: { 'content-type': 'application/json' },
      ...init,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const error = (body as { error?: ApiError } | null)?.error ?? {
        code: 'unknown_error',
        message: `Request failed with status ${response.status}`,
      };
      throw new ApiRequestError(response.status, error);
    }

    return (await response.json()) as T;
  }

  async health(): Promise<{ status: string; storage: string }> {
    return this.request('/health');
  }

  // --- Projects ---
  async listProjects(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/projects');
    return applyFilter(identifiers, query.filter);
  }

  async getProject(id: string): Promise<Project> {
    return this.request(`/projects/${encodeURIComponent(id)}`);
  }

  async createProject(project: Project): Promise<{ id: string }> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, project: Project): Promise<{ id: string }> {
    return this.request(`/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- Test Suites ---
  async listTestSuites(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_suites');
    return applyFilter(identifiers, query.filter);
  }

  async getTestSuite(id: string): Promise<TestSuite> {
    return this.request(`/test_suites/${encodeURIComponent(id)}`);
  }

  async createTestSuite(suite: TestSuite): Promise<{ id: string }> {
    return this.request('/test_suites', {
      method: 'POST',
      body: JSON.stringify(suite),
    });
  }

  async updateTestSuite(id: string, suite: TestSuite): Promise<{ id: string }> {
    return this.request(`/test_suites/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(suite),
    });
  }

  async deleteTestSuite(id: string): Promise<void> {
    await this.request(`/test_suites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- Test Cases ---
  async listTestCases(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_cases');
    return applyFilter(identifiers, query.filter);
  }

  async getTestCase(id: string): Promise<TestCase> {
    return this.request(`/test_cases/${encodeURIComponent(id)}`);
  }

  async createTestCase(testCase: TestCase): Promise<{ id: string }> {
    return this.request('/test_cases', {
      method: 'POST',
      body: JSON.stringify(testCase),
    });
  }

  async updateTestCase(id: string, testCase: TestCase): Promise<{ id: string }> {
    return this.request(`/test_cases/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(testCase),
    });
  }

  async deleteTestCase(id: string): Promise<void> {
    await this.request(`/test_cases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // --- Attachments ---
  async uploadAttachment(testCaseId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.fetchImpl.call(
      globalThis,
      `${this.baseUrl}/test_cases/${encodeURIComponent(testCaseId)}/attachments`,
      {
        method: 'POST',
        body: formData,
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const error = (body as { error?: ApiError } | null)?.error ?? {
        code: 'unknown_error',
        message: `Request failed with status ${response.status}`,
      };
      throw new ApiRequestError(response.status, error);
    }

    return (await response.json()) as Attachment;
  }

  getAttachmentUrl(testCaseId: string, filename: string): string {
    return `${this.baseUrl}/test_cases/${encodeURIComponent(testCaseId)}/attachments/${encodeURIComponent(filename)}`;
  }

  async deleteAttachment(testCaseId: string, filename: string): Promise<void> {
    await this.request(
      `/test_cases/${encodeURIComponent(testCaseId)}/attachments/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      },
    );
  }

  // --- Test Runs ---
  async listTestRuns(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_runs');
    return applyFilter(identifiers, query.filter);
  }

  async getTestRun(id: string): Promise<TestRun> {
    return this.request(`/test_runs/${encodeURIComponent(id)}`);
  }

  async createTestRun(run: TestRun): Promise<{ id: string }> {
    return this.request('/test_runs', {
      method: 'POST',
      body: JSON.stringify(run),
    });
  }

  async updateTestRun(id: string, run: TestRun): Promise<{ id: string }> {
    return this.request(`/test_runs/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(run),
    });
  }

  async deleteTestRun(id: string): Promise<void> {
    await this.request(`/test_runs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Records one case's outcome against a run (`recordTestRunResult` in the
   * contract). The API appends or replaces the run's result for that case; the
   * case document is never touched.
   */
  async recordTestRunResult(id: string, result: TestResultInput): Promise<{ message: string }> {
    return this.request(`/test_runs/${encodeURIComponent(id)}/results`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }

  /**
   * Lists the defects linked to one run result (`listResultDefects`). An empty
   * list means the result exists and carries no link; an unknown run or a run
   * with no result for that case answers 404 instead.
   */
  async listResultDefects(id: string, caseId: string): Promise<DefectLink[]> {
    const body = await this.request<{ defects?: DefectLink[] }>(
      `/test_runs/${encodeURIComponent(id)}/results/${encodeURIComponent(caseId)}/defects`,
    );
    return body.defects ?? [];
  }

  /**
   * Links a defect to one run result (`linkResultDefect`). The API owns the
   * link identity and the timestamp, and answers 409 rather than linking the
   * same `defectId` twice.
   */
  async linkResultDefect(
    id: string,
    caseId: string,
    link: DefectLinkInput,
  ): Promise<{ id: string; message: string }> {
    return this.request(`/test_runs/${encodeURIComponent(id)}/results/${encodeURIComponent(caseId)}/defects`, {
      method: 'POST',
      body: JSON.stringify(link),
    });
  }

  /** Removes one defect link by the identifier the link route returned. */
  async unlinkResultDefect(
    id: string,
    caseId: string,
    linkId: string,
  ): Promise<{ message: string }> {
    return this.request(
      `/test_runs/${encodeURIComponent(id)}/results/${encodeURIComponent(caseId)}/defects/${encodeURIComponent(linkId)}`,
      { method: 'DELETE' },
    );
  }

  // --- Milestones ---
  async listMilestones(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/milestones');
    return applyFilter(identifiers, query.filter);
  }

  async getMilestone(id: string): Promise<Milestone> {
    return this.request(`/milestones/${encodeURIComponent(id)}`);
  }

  async createMilestone(milestone: Milestone): Promise<{ id: string }> {
    return this.request('/milestones', {
      method: 'POST',
      body: JSON.stringify(milestone),
    });
  }

  async updateMilestone(id: string, milestone: Milestone): Promise<{ id: string }> {
    return this.request(`/milestones/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(milestone),
    });
  }

  async deleteMilestone(id: string): Promise<void> {
    await this.request(`/milestones/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async getMilestoneProgress(id: string): Promise<MilestoneProgress> {
    return this.request(`/milestones/${encodeURIComponent(id)}/progress`);
  }
}

export function applyFilter(identifiers: string[], filter?: string): string[] {
  if (!filter) {
    return identifiers;
  }
  const needle = filter.toLowerCase();
  return identifiers.filter((identifier) => identifier.toLowerCase().includes(needle));
}

/**
 * Milliseconds since the epoch for a run timestamp. The contract documents
 * ISO-8601, the API has also served Unix seconds as a string; anything else
 * sorts oldest so a readable run still wins.
 */
function runTimestamp(run: TestRun): number {
  const raw = (run.timestamp ?? '').trim();
  if (/^\d+$/.test(raw)) {
    return Number(raw) * 1000;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/**
 * The run the case table reads statuses from: the most recent one, with the
 * later entry winning a tie so the newest write is never hidden by a
 * same-second sibling.
 */
export function latestTestRun(runs: readonly TestRun[] | null | undefined): TestRun | null {
  let latest: TestRun | null = null;
  for (const run of runs ?? []) {
    if (latest === null || runTimestamp(run) >= runTimestamp(latest)) {
      latest = run;
    }
  }
  return latest;
}

/**
 * The status a run recorded for one case, or `null` when the run carries no
 * result for it. Callers render an empty state for `null` rather than
 * inventing a status (issue #65).
 */
export function resultStatus(
  run: TestRun | null | undefined,
  testCaseId: string | null | undefined,
): TestResultStatus | null {
  if (!run || !testCaseId) {
    return null;
  }
  // A run appends results, so the last entry for the case is the current one.
  const results = run.results ?? [];
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const entry = results[index];
    if (entry?.testCaseId === testCaseId) {
      return entry.status ?? null;
    }
  }
  return null;
}
