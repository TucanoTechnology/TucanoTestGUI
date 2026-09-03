import { render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import App from './App';
import { TucanoApiClient } from './api/client';

function clientReturning(identifiers: string[]): TucanoApiClient {
  const stubFetch = (async () =>
    new Response(JSON.stringify(identifiers), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
  return new TucanoApiClient('/api', stubFetch);
}

function clientFailing(status: number, code: string, message: string): TucanoApiClient {
  const stubFetch = (async () =>
    new Response(JSON.stringify({ error: { code, message } }), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
  return new TucanoApiClient('/api', stubFetch);
}

describe('App', () => {
  it('has no detectable WCAG 2.1 AA violations', async () => {
    const { container } = render(<App client={clientReturning(['regression.json'])} />);
    await screen.findByText(/1 test suite found/);

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('exposes a skip link and a labelled filter control', async () => {
    render(<App client={clientReturning([])} />);

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeDefined();
    expect(screen.getByLabelText(/filter test suites/i)).toBeDefined();
  });

  it('announces the number of suites returned by the API', async () => {
    render(<App client={clientReturning(['a.json', 'b.json'])} />);

    const status = await screen.findByText(/2 test suites found/);
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('reports API failures without exposing internals', async () => {
    render(<App client={clientFailing(500, 'storage_error', 'Storage operation failed')} />);

    await waitFor(() => {
      expect(screen.getByText(/could not load test suites/i)).toBeDefined();
    });
  });
});
