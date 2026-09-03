import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ApiRequestError, TucanoApiClient } from './api/client';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface AppProps {
  client?: TucanoApiClient;
}

export default function App({ client }: AppProps) {
  const api = useMemo(() => client ?? new TucanoApiClient(), [client]);
  const [suites, setSuites] = useState<string[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const filterId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(
    async (currentFilter: string) => {
      setState('loading');
      setMessage('Loading test suites.');
      try {
        const identifiers = await api.listTestSuites({ filter: currentFilter });
        setSuites(identifiers);
        setState('ready');
        setMessage(
          identifiers.length === 0
            ? 'No test suites match the current filter.'
            : `${identifiers.length} test suite${identifiers.length === 1 ? '' : 's'} found.`,
        );
      } catch (error) {
        setState('error');
        setMessage(
          error instanceof ApiRequestError
            ? `Could not load test suites: ${error.message}`
            : 'Could not reach the Tucano Test API.',
        );
      }
    },
    [api],
  );

  useEffect(() => {
    void load('');
  }, [load]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header>
        <h1>Tucano Test</h1>
      </header>
      <main id="main" tabIndex={-1}>
        <h2>Test suites</h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load(filter);
          }}
        >
          <label htmlFor={filterId}>Filter test suites</label>
          <input
            id={filterId}
            name="filter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <button type="submit">Apply filter</button>
        </form>

        <p aria-live="polite" ref={statusRef} className="status">
          {message}
        </p>

        {state === 'ready' && suites.length > 0 && (
          <ul aria-label="Test suites">
            {suites.map((suite) => (
              <li key={suite}>{suite}</li>
            ))}
          </ul>
        )}
      </main>
      <footer>
        <p>Data is served by the Tucano Test API.</p>
      </footer>
    </>
  );
}
