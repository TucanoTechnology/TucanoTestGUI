import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function mockFullClient(): TucanoApiClient {
  const projects = ['PROJ-1.json'];
  const suites = ['SmokeTest.json'];
  const cases = ['TC-1.json'];
  const runs = ['RUN-1.json'];
  const milestones = ['M-1.json'];

  const stubFetch = (async (url: string, init?: RequestInit) => {
    const urlStr = String(url);
    const method = init?.method || 'GET';

    if (urlStr.includes('/milestones')) {
      if (method === 'GET') {
        if (urlStr.endsWith('/progress')) {
          return new Response(JSON.stringify({
            milestoneId: 'M-1.json',
            totalCases: 2,
            passed: 1,
            failed: 1,
            blocked: 0,
            untested: 0,
            retest: 0,
            passPercentage: 50.0,
          }));
        }
        if (urlStr.endsWith('/M-1.json')) {
          return new Response(JSON.stringify({
            milestoneId: 'M-1.json',
            name: 'v1.0-RC1',
            status: 'Open',
            testRunIds: ['RUN-1.json'],
          }));
        }
        return new Response(JSON.stringify(milestones));
      }
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string);
        milestones.push(body.milestoneId);
        return new Response(JSON.stringify({ id: body.milestoneId }), { status: 201 });
      }
    }

    if (urlStr.includes('/projects')) {
      if (method === 'GET') {
        if (urlStr.endsWith('/PROJ-1.json')) {
          return new Response(JSON.stringify({ projectId: 'PROJ-1.json', name: 'Project 1', testSuites: [] }));
        }
        return new Response(JSON.stringify(projects));
      }
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string);
        projects.push(body.projectId);
        return new Response(JSON.stringify({ id: body.projectId }), { status: 201 });
      }
    }

    if (urlStr.includes('/test_suites')) {
      if (method === 'GET') {
        if (urlStr.endsWith('/SmokeTest.json')) {
          return new Response(JSON.stringify({ suiteId: 'SmokeTest.json', name: 'Smoke Test', testCases: [] }));
        }
        return new Response(JSON.stringify(suites));
      }
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string);
        suites.push(body.suiteId);
        return new Response(JSON.stringify({ id: body.suiteId }), { status: 201 });
      }
    }

    if (urlStr.includes('/test_cases')) {
      if (method === 'GET') {
        if (urlStr.endsWith('/TC-1.json')) {
          return new Response(JSON.stringify({
            testCaseId: 'TC-1.json',
            title: 'Verify Login',
            expectedResult: 'Dashboard displays',
            description: 'Preconditions: user exists',
            priority: 'High',
            steps: ['Navigate to /login', 'Enter credentials'],
            attachments: [],
          }));
        }
        return new Response(JSON.stringify(cases));
      }
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string);
        cases.push(body.testCaseId);
        return new Response(JSON.stringify({ id: body.testCaseId }), { status: 201 });
      }
    }

    if (urlStr.includes('/test_runs')) {
      if (method === 'GET') {
        if (urlStr.endsWith('/RUN-1.json')) {
          return new Response(JSON.stringify({
            testRunId: 'RUN-1.json',
            timestamp: '2026-09-04T00:00:00Z',
            testCases: [
              {
                testCaseId: 'TC-1.json',
                title: 'Verify Login',
                expectedResult: 'Dashboard displays',
                steps: ['Navigate to /login', 'Enter credentials'],
              },
            ],
          }));
        }
        return new Response(JSON.stringify(runs));
      }
      if (method === 'POST') {
        const body = JSON.parse(init?.body as string);
        runs.push(body.testRunId);
        return new Response(JSON.stringify({ id: body.testRunId }), { status: 201 });
      }
      if (method === 'PUT') {
        return new Response(JSON.stringify({ id: 'RUN-1.json' }), { status: 200 });
      }
    }

    return new Response(JSON.stringify([]));
  }) as unknown as typeof fetch;

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

  it('allows tab navigation across Projects, Tests, and Test runs', async () => {
    render(<App client={clientReturning(['PROJ-1', 'TC-1'])} />);

    fireEvent.click(screen.getByRole('button', { name: /^projects$/i }));
    await screen.findByText(/2 projects found/i);

    fireEvent.click(screen.getByRole('button', { name: /^tests$/i }));
    await screen.findByText(/2 tests found/i);

    fireEvent.click(screen.getByRole('button', { name: /^test runs$/i }));
    await screen.findByText(/2 test runs found/i);
  });

  it('supports arrow-key navigation within the icon rail', async () => {
    render(<App client={clientReturning([])} />);

    const projects = screen.getByRole('button', { name: /^projects$/i });
    const suites = screen.getByRole('button', { name: /^test suites$/i });
    const milestones = screen.getByRole('button', { name: /^milestones$/i });

    projects.focus();
    expect(document.activeElement).toBe(projects);

    fireEvent.keyDown(projects, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(suites);

    fireEvent.keyDown(suites, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(projects);

    fireEvent.keyDown(projects, { key: 'End' });
    expect(document.activeElement).toBe(milestones);
  });

  it('opens and closes creation modal when button is clicked', async () => {
    render(<App client={clientReturning([])} />);

    fireEvent.click(screen.getByRole('button', { name: /\+ create test suite/i }));
    expect(screen.getByText(/create new test suite/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText(/create new test suite/i)).toBeNull();
  });

  it('allows creating a new project via project modal form', async () => {
    render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^projects$/i }));
    await screen.findByText(/1 project found/i);

    fireEvent.click(screen.getByRole('button', { name: /\+ create project/i }));
    expect(screen.getByRole('dialog', { name: /create new project/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/project id/i), { target: { value: 'PROJ-2' } });
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Checkout App' } });
    fireEvent.submit(screen.getByRole('button', { name: /save project/i }).closest('form')!);

    await screen.findByText(/project PROJ-2.json created successfully/i);
  });

  it('allows creating a test case with step-by-step actions', async () => {
    render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^tests$/i }));
    await screen.findByText(/1 test found/i);

    const createCaseBtns = screen.getAllByRole('button', { name: /\+ create test case/i });
    fireEvent.click(createCaseBtns[0]!);
    expect(screen.getByRole('dialog', { name: /create new test case/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/test case id/i), { target: { value: 'TC-2' } });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Submit Order' } });
    fireEvent.change(screen.getByLabelText(/expected result/i), { target: { value: 'Order ID generated' } });
    fireEvent.change(screen.getByLabelText(/step 1/i), { target: { value: 'Add item to cart' } });

    fireEvent.click(screen.getByRole('button', { name: /\+ add step/i }));
    fireEvent.change(screen.getByLabelText(/step 2/i), { target: { value: 'Proceed to checkout' } });

    fireEvent.submit(screen.getByRole('button', { name: /save test case/i }).closest('form')!);

    await screen.findByText(/test case TC-2.json created successfully/i);
  });

  it('launches tester execution workspace and marks test results', async () => {
    render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^test runs$/i }));
    await screen.findByText(/1 test run found/i);

    fireEvent.click(screen.getByRole('button', { name: /^execute$/i }));
    await screen.findByText(/execution workspace: RUN-1.json/i);

    expect(screen.getByText(/verify login/i)).toBeDefined();
    expect(screen.getByText(/navigate to \/login/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /mark passed/i }));
    await screen.findByText(/marked verify login as passed/i);
  });

  it('validates WCAG 2.1 AA on test execution workspace', async () => {
    const { container } = render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^test runs$/i }));
    await screen.findByText(/1 test run found/i);

    fireEvent.click(screen.getByRole('button', { name: /^execute$/i }));
    await screen.findByText(/execution workspace: RUN-1.json/i);

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('allows navigating to Milestones tab and creating a milestone', async () => {
    render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^milestones$/i }));
    await screen.findByText(/1 milestone found/i);

    fireEvent.click(screen.getByRole('button', { name: /\+ create milestone/i }));
    expect(screen.getByRole('dialog', { name: /create new milestone/i })).toBeDefined();

    fireEvent.change(screen.getByLabelText(/milestone id/i), { target: { value: 'M-2' } });
    fireEvent.change(screen.getByLabelText(/milestone name/i), { target: { value: 'Release v1.0' } });
    fireEvent.submit(screen.getByRole('button', { name: /save milestone/i }).closest('form')!);

    await screen.findByText(/milestone M-2.json created successfully/i);
  });

  it('allows collapsing and expanding hierarchy planes', async () => {
    render(<App client={clientReturning(['SmokeTest.json'])} />);
    await screen.findByText(/1 test suite found/i);

    const collapseBtns = screen.getAllByRole('button', { name: /collapse/i });
    expect(collapseBtns.length).toBeGreaterThan(0);

    fireEvent.click(collapseBtns[0]!);
    expect(screen.getAllByRole('button', { name: /expand/i }).length).toBeGreaterThan(0);
  });

  it('allows editing an existing test suite via edit modal', async () => {
    render(<App client={mockFullClient()} />);
    await screen.findByText(/1 test suite found/i);

    const editBtns = screen.getAllByRole('button', { name: /^edit$/i });
    fireEvent.click(editBtns[0]!);

    const dialog = await screen.findByRole('dialog', { name: /edit test suite/i });
    expect(dialog).toBeDefined();

    fireEvent.change(screen.getByLabelText(/suite name/i), { target: { value: 'Updated Suite Name' } });
    fireEvent.submit(screen.getByRole('button', { name: /update test suite/i }).closest('form')!);

    await screen.findByText(/test suite SmokeTest.json updated successfully/i);
  });

  it('reports API failures without exposing internals', async () => {
    render(<App client={clientFailing(500, 'storage_error', 'Storage operation failed')} />);

    await waitFor(() => {
      expect(screen.getByText(/could not load test suites/i)).toBeDefined();
    });
  });

  it('renders three-panel layout and opens test case detail when row is clicked', async () => {
    render(<App client={mockFullClient()} />);

    // Switch to Tests tab
    fireEvent.click(screen.getByRole('button', { name: /^tests$/i }));
    await screen.findByText(/1 test found/i);

    // Verify folder hierarchy panel (Pane 1)
    expect(screen.getByText(/test case folders/i)).toBeDefined();
    expect(screen.getAllByText(/all test cases/i).length).toBeGreaterThan(0);

    // Verify table (Pane 2) and wait for cases to load
    const caseRow = await screen.findByText(/verify login/i);
    expect(caseRow).toBeDefined();

    // Click on row to open DetailView (Pane 3)
    fireEvent.click(caseRow);

    // Verify Detail panel header and content
    const closeBtn = await screen.findByRole('button', { name: /close detail panel/i });
    expect(closeBtn).toBeDefined();
    expect(await screen.findByRole('button', { name: /steps & description/i })).toBeDefined();
  });

  it('passes WCAG 2.1 AA accessibility checks on the three-panel layout', async () => {
    const { container } = render(<App client={mockFullClient()} />);

    fireEvent.click(screen.getByRole('button', { name: /^tests$/i }));
    await screen.findByText(/1 test found/i);

    // Open detail panel
    const caseRow = await screen.findByText(/verify login/i);
    fireEvent.click(caseRow);
    await screen.findByRole('button', { name: /steps & description/i });

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });

    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
