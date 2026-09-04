import { describe, expect, it } from 'vitest';
import { ApiRequestError, TucanoApiClient, applyFilter } from './client';

function stubFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('applyFilter', () => {
  it('returns every identifier when no filter is supplied', () => {
    expect(applyFilter(['a.json', 'b.json'])).toEqual(['a.json', 'b.json']);
  });

  it('matches case insensitively on a substring', () => {
    expect(applyFilter(['Regression.json', 'smoke.json'], 'REGRESS')).toEqual([
      'Regression.json',
    ]);
  });

  it('returns nothing when no identifier matches', () => {
    expect(applyFilter(['a.json'], 'zzz')).toEqual([]);
  });
});

describe('TucanoApiClient', () => {
  it('returns identifiers from the API', async () => {
    const client = new TucanoApiClient('/api', stubFetch(200, ['regression.json']));
    await expect(client.listTestSuites()).resolves.toEqual(['regression.json']);
  });

  it('handles project operations', async () => {
    const client = new TucanoApiClient(
      '/api',
      stubFetch(200, { projectId: 'PROJ-1', name: 'Project 1', testSuites: [] }),
    );
    await expect(client.getProject('PROJ-1')).resolves.toEqual({
      projectId: 'PROJ-1',
      name: 'Project 1',
      testSuites: [],
    });
  });

  it('handles test case operations', async () => {
    const client = new TucanoApiClient(
      '/api',
      stubFetch(200, { testCaseId: 'TC-1', title: 'Login', expectedResult: 'Success' }),
    );
    await expect(client.getTestCase('TC-1')).resolves.toEqual({
      testCaseId: 'TC-1',
      title: 'Login',
      expectedResult: 'Success',
    });
  });

  it('handles test run operations', async () => {
    const client = new TucanoApiClient(
      '/api',
      stubFetch(200, { testRunId: 'RUN-1', timestamp: '2026-09-04T00:00:00Z', testCases: [] }),
    );
    await expect(client.getTestRun('RUN-1')).resolves.toEqual({
      testRunId: 'RUN-1',
      timestamp: '2026-09-04T00:00:00Z',
      testCases: [],
    });
  });

  it('builds attachment URLs correctly', () => {
    const client = new TucanoApiClient('/api', stubFetch(200, {}));
    expect(client.getAttachmentUrl('TC-1', 'shot.png')).toBe(
      '/api/test_cases/TC-1/attachments/shot.png',
    );
  });

  it('surfaces the API error envelope', async () => {
    const client = new TucanoApiClient(
      '/api',
      stubFetch(404, { error: { code: 'not_found', message: 'Resource not found' } }),
    );

    await expect(client.getTestSuite('missing.json')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('falls back to a safe error when the body is not an envelope', async () => {
    const client = new TucanoApiClient('/api', stubFetch(503, 'unavailable'));

    await expect(client.listTestRuns()).rejects.toMatchObject({ code: 'unknown_error' });
  });
});
