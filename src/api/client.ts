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

export interface TestCase {
  testCaseId: string;
  title: string;
  description?: string;
  steps?: string[];
  expectedResult: string;
  priority?: string;
  exploratory?: boolean;
  attachments?: Attachment[];
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
