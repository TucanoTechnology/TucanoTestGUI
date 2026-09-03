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

export interface TestCase {
  testCaseId: string;
  title: string;
  expectedResult: string;
  description?: string;
  steps?: string[];
  priority?: string;
}

export interface TestSuite {
  suiteId: string;
  name: string;
  description?: string;
  testCases: TestCase[];
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
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
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

  // Server-side filtering is not available yet, so identifiers are filtered here.
  async listTestSuites(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_suites');
    return applyFilter(identifiers, query.filter);
  }

  async listTestCases(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_cases');
    return applyFilter(identifiers, query.filter);
  }

  async listTestRuns(query: ListQuery = {}): Promise<string[]> {
    const identifiers = await this.request<string[]>('/test_runs');
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
}

export function applyFilter(identifiers: string[], filter?: string): string[] {
  if (!filter) {
    return identifiers;
  }
  const needle = filter.toLowerCase();
  return identifiers.filter((identifier) => identifier.toLowerCase().includes(needle));
}
