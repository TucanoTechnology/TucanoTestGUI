import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_API_BASE_URL, apiErrorEnvelope, createApiClient, resolveApiBaseUrl } from './configure';
import { ApiError } from './generated';

describe('resolveApiBaseUrl', () => {
  it('falls back to the proxied path when nothing is configured', () => {
    expect(resolveApiBaseUrl()).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl(undefined)).toBe('/api');
    expect(resolveApiBaseUrl(null)).toBe('/api');
  });

  it('ignores a blank configuration', () => {
    expect(resolveApiBaseUrl('')).toBe(DEFAULT_API_BASE_URL);
    expect(resolveApiBaseUrl('   ')).toBe(DEFAULT_API_BASE_URL);
  });

  it('strips trailing slashes so paths are never joined as //', () => {
    expect(resolveApiBaseUrl('/api/')).toBe('/api');
    expect(resolveApiBaseUrl('/api///')).toBe('/api');
    expect(resolveApiBaseUrl('https://api.example.test/v1/')).toBe('https://api.example.test/v1');
    expect(resolveApiBaseUrl('https://api.example.test/v1///')).toBe('https://api.example.test/v1');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveApiBaseUrl('  /gateway/api  ')).toBe('/gateway/api');
    expect(resolveApiBaseUrl('\thttps://api.example.test/\n')).toBe('https://api.example.test');
  });
});

describe('createApiClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const baseUrlOf = (client: ReturnType<typeof createApiClient>) => client.request.config.BASE;
  const tokenOf = (client: ReturnType<typeof createApiClient>) => client.request.config.TOKEN;

  it('targets /api by default, never the generated localhost placeholder', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(baseUrlOf(createApiClient())).toBe('/api');
  });

  it('uses VITE_API_BASE_URL when the build defines one', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/');
    expect(baseUrlOf(createApiClient())).toBe('https://api.example.test');
  });

  it('prefers an explicit baseUrl over the build variable', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://from-env.example.test');
    expect(baseUrlOf(createApiClient({ baseUrl: '/from-option' }))).toBe('/from-option');
  });

  it('carries the bearer token into the request config', () => {
    const client = createApiClient({ token: 'session-token' });
    expect(tokenOf(client)).toBe('session-token');
    expect(tokenOf(createApiClient())).toBeUndefined();
  });

  it('merges extra headers into the request config', () => {
    const client = createApiClient({ headers: { 'X-Trace': 'abc' } });
    expect(client.request.config.HEADERS).toEqual({ 'X-Trace': 'abc' });
    expect(createApiClient().request.config.HEADERS).toBeUndefined();
  });

  it('exposes the generated service groups', () => {
    const client = createApiClient();
    expect(client.projects).toBeDefined();
    expect(client.testSuites).toBeDefined();
    expect(client.testCases).toBeDefined();
    expect(client.testRuns).toBeDefined();
    expect(client.milestones).toBeDefined();
    expect(client.reports).toBeDefined();
    expect(client.configurations).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});

describe('apiErrorEnvelope', () => {
  const failedCall = (body: unknown, status = 409) =>
    new ApiError(
      { method: 'POST', url: '/test_cases/{id}/duplicate' },
      { url: '/api/test_cases/TC-1/duplicate', ok: false, status, statusText: 'Conflict', body },
      'Conflict',
    );

  it('reads the code and message the API publishes', () => {
    expect(
      apiErrorEnvelope(failedCall({ error: { code: 'conflict', message: 'Already exists.' } })),
    ).toEqual({ code: 'conflict', message: 'Already exists.' });
  });

  it('returns null for a body that carries no envelope', () => {
    expect(apiErrorEnvelope(failedCall('length limit exceeded', 413))).toBeNull();
    expect(apiErrorEnvelope(failedCall(undefined, 502))).toBeNull();
    expect(apiErrorEnvelope(failedCall(null))).toBeNull();
  });

  it('returns null when the envelope is incomplete or the wrong shape', () => {
    expect(apiErrorEnvelope(failedCall({ error: { code: 'conflict' } }))).toBeNull();
    expect(apiErrorEnvelope(failedCall({ error: 'conflict' }))).toBeNull();
    expect(apiErrorEnvelope(failedCall({ message: 'Already exists.' }))).toBeNull();
  });

  it('returns null for anything that is not a failed API call', () => {
    expect(apiErrorEnvelope(new Error('offline'))).toBeNull();
    expect(apiErrorEnvelope(undefined)).toBeNull();
    expect(apiErrorEnvelope({ body: { error: { code: 'conflict', message: 'Already exists.' } } })).toBeNull();
  });
});
