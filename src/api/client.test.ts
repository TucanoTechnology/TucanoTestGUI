import { describe, expect, it } from 'vitest';
import {
  ApiRequestError,
  TucanoApiClient,
  TestRun,
  applyFilter,
  latestTestRun,
  resultStatus,
} from './client';

function stubFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

/** Captures the request so a test can assert the verb, URL and payload. */
function recordingFetch(body: unknown, status = 200) {
  const requests: { url: string; method: string; body: unknown }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    requests.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
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

  it('handles milestone and progress operations', async () => {
    const client = new TucanoApiClient(
      '/api',
      stubFetch(200, {
        milestoneId: 'M-1.json',
        totalCases: 5,
        passed: 4,
        failed: 1,
        blocked: 0,
        untested: 0,
        retest: 0,
        passPercentage: 80,
      }),
    );
    await expect(client.getMilestoneProgress('M-1.json')).resolves.toEqual({
      milestoneId: 'M-1.json',
      totalCases: 5,
      passed: 4,
      failed: 1,
      blocked: 0,
      untested: 0,
      retest: 0,
      passPercentage: 80,
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

  it('records a result against the run, not the case', async () => {
    const { fetchImpl, requests } = recordingFetch({ message: 'Recorded Passed for TC-1.json.' });
    const client = new TucanoApiClient('/api', fetchImpl);

    await expect(
      client.recordTestRunResult('RUN-1.json', { testCaseId: 'TC-1.json', status: 'Passed' }),
    ).resolves.toEqual({ message: 'Recorded Passed for TC-1.json.' });

    // The run owns the result, so this is the only URL a status can travel on.
    expect(requests).toEqual([
      {
        url: '/api/test_runs/RUN-1.json/results',
        method: 'POST',
        body: { testCaseId: 'TC-1.json', status: 'Passed' },
      },
    ]);
  });
});

describe('result defects', () => {
  const link = {
    linkId: 'LINK-1',
    defectId: 'PROJ-42',
    defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
    trackerType: 'jira' as const,
    title: 'Login rejects a valid user',
    linkedAt: '1757030400',
  };

  it('lists the defects linked to one run result', async () => {
    const { fetchImpl, requests } = recordingFetch({ defects: [link] });
    const client = new TucanoApiClient('/api', fetchImpl);

    await expect(client.listResultDefects('RUN-1.json', 'TC-1.json')).resolves.toEqual([link]);
    expect(requests).toEqual([
      {
        url: '/api/test_runs/RUN-1.json/results/TC-1.json/defects',
        method: 'GET',
        body: undefined,
      },
    ]);
  });

  it('reads an empty list rather than failing when no defect is linked', async () => {
    const client = new TucanoApiClient('/api', stubFetch(200, { defects: [] }));
    await expect(client.listResultDefects('RUN-1.json', 'TC-1.json')).resolves.toEqual([]);
  });

  it('links a defect through the result route, leaving the identity to the API', async () => {
    const { fetchImpl, requests } = recordingFetch({ id: 'LINK-1', message: 'Defect linked.' }, 201);
    const client = new TucanoApiClient('/api', fetchImpl);

    await expect(
      client.linkResultDefect('RUN-1.json', 'TC-1.json', {
        defectId: 'PROJ-42',
        defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
        trackerType: 'jira',
        title: 'Login rejects a valid user',
      }),
    ).resolves.toEqual({ id: 'LINK-1', message: 'Defect linked.' });

    // `linkId` and `linkedAt` are the API's to derive; sending either is a 400.
    expect(requests).toEqual([
      {
        url: '/api/test_runs/RUN-1.json/results/TC-1.json/defects',
        method: 'POST',
        body: {
          defectId: 'PROJ-42',
          defectUrl: 'https://acme.atlassian.net/browse/PROJ-42',
          trackerType: 'jira',
          title: 'Login rejects a valid user',
        },
      },
    ]);
  });

  it('unlinks a defect by its own link identifier', async () => {
    const { fetchImpl, requests } = recordingFetch({ message: 'Defect unlinked.' });
    const client = new TucanoApiClient('/api', fetchImpl);

    await expect(client.unlinkResultDefect('RUN-1.json', 'TC-1.json', 'LINK-1')).resolves.toEqual({
      message: 'Defect unlinked.',
    });
    expect(requests).toEqual([
      {
        url: '/api/test_runs/RUN-1.json/results/TC-1.json/defects/LINK-1',
        method: 'DELETE',
        body: undefined,
      },
    ]);
  });

  it('escapes every identifier it puts on the defect route', async () => {
    const { fetchImpl, requests } = recordingFetch({ defects: [] });
    const client = new TucanoApiClient('/api', fetchImpl);

    await client.unlinkResultDefect('RUN 1.json', 'TC 1.json', 'LINK/1');

    expect(requests[0]?.url).toBe(
      '/api/test_runs/RUN%201.json/results/TC%201.json/defects/LINK%2F1',
    );
  });
});

describe('resultStatus', () => {
  const run: TestRun = {
    testRunId: 'RUN-1.json',
    timestamp: '2026-09-04T00:00:00Z',
    results: [
      { testCaseId: 'TC-1.json', status: 'Failed' },
      { testCaseId: 'TC-2.json', status: 'Blocked' },
      { testCaseId: 'TC-1.json', status: 'Passed' },
    ],
  };

  it('reads the status the run recorded for a case', () => {
    expect(resultStatus(run, 'TC-2.json')).toBe('Blocked');
  });

  it('takes the most recent entry when a case was recorded more than once', () => {
    expect(resultStatus(run, 'TC-1.json')).toBe('Passed');
  });

  it('returns null instead of inventing a status', () => {
    expect(resultStatus(run, 'TC-9.json')).toBeNull();
    expect(resultStatus(run, '')).toBeNull();
    expect(resultStatus(undefined, 'TC-1.json')).toBeNull();
    expect(resultStatus({ testRunId: 'RUN-2.json', timestamp: '2026-09-04T00:00:00Z' }, 'TC-1.json')).toBeNull();
  });
});

describe('latestTestRun', () => {
  it('picks the newest run by timestamp', () => {
    const older: TestRun = { testRunId: 'RUN-1.json', timestamp: '2026-09-01T00:00:00Z' };
    const newer: TestRun = { testRunId: 'RUN-2.json', timestamp: '2026-09-04T00:00:00Z' };
    expect(latestTestRun([older, newer])?.testRunId).toBe('RUN-2.json');
    expect(latestTestRun([newer, older])?.testRunId).toBe('RUN-2.json');
  });

  it('compares Unix-second timestamps numerically, not as strings', () => {
    const older: TestRun = { testRunId: 'RUN-1.json', timestamp: '1757030400' };
    const newer: TestRun = { testRunId: 'RUN-2.json', timestamp: '1757289600' };
    expect(latestTestRun([newer, older])?.testRunId).toBe('RUN-2.json');
  });

  it('lets the later entry win a tie so the newest write is shown', () => {
    const first: TestRun = { testRunId: 'RUN-1.json', timestamp: '2026-09-04T00:00:00Z' };
    const second: TestRun = { testRunId: 'RUN-2.json', timestamp: '2026-09-04T00:00:00Z' };
    expect(latestTestRun([first, second])?.testRunId).toBe('RUN-2.json');
  });

  it('returns null when there is no run to read', () => {
    expect(latestTestRun([])).toBeNull();
    expect(latestTestRun(undefined)).toBeNull();
  });
});
