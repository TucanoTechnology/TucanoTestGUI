import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  ApiRequestError,
  DEFECT_TRACKER_TYPES,
  DefectLink,
  DefectTrackerType,
  TucanoApiClient,
} from '../../api/client';

/**
 * Defect links on one run result (issue #60).
 *
 * A failed or blocked result usually raises a defect somewhere else — Jira,
 * GitHub, GitLab — and this panel is where that reference is recorded. The API
 * owns the links, so every render is driven by `listResultDefects` and every
 * write is followed by a re-read rather than a local guess.
 */

export interface ResultDefectsProps {
  client: TucanoApiClient;
  /** The run whose result is being inspected. */
  runId: string;
  /** The case the inspected result belongs to. */
  caseId: string;
  onStatus: (message: string, state?: 'info' | 'error') => void;
}

type ListState = 'loading' | 'ready' | 'error';

interface Failure {
  code: string;
  message: string;
}

function toFailure(error: unknown, fallback: string): Failure {
  if (error instanceof ApiRequestError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'network_error', message: fallback };
}

/**
 * The API only accepts an issue URL for the named tracker, but the URL is still
 * server-supplied text: only `https:` addresses become links, so a stored
 * `javascript:` value can never be rendered as one.
 */
function safeHref(url: string): string | null {
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export default function ResultDefects({ client, runId, caseId, onStatus }: ResultDefectsProps) {
  const [links, setLinks] = useState<DefectLink[]>([]);
  const [listState, setListState] = useState<ListState>('loading');
  const [listFailure, setListFailure] = useState<Failure | null>(null);

  const [trackerType, setTrackerType] = useState<DefectTrackerType>('jira');
  const [defectId, setDefectId] = useState('');
  const [defectUrl, setDefectUrl] = useState('');
  const [defectTitle, setDefectTitle] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const fieldId = useId();

  // The result this panel describes is whichever case the board is showing.
  useEffect(() => {
    let cancelled = false;
    setListState('loading');
    setListFailure(null);

    client
      .listResultDefects(runId, caseId)
      .then((found) => {
        if (cancelled) return;
        setLinks(found);
        setListState('ready');
        setAnnouncement('');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setListFailure(toFailure(error, 'Could not reach the Tucano Test API.'));
        setListState('error');
        setAnnouncement(`Could not load linked defects for ${caseId}.`);
      });

    return () => {
      cancelled = true;
    };
  }, [client, runId, caseId]);

  /** The API owns the list, so every write is followed by a re-read. */
  const refresh = async (): Promise<void> => {
    const found = await client.listResultDefects(runId, caseId);
    setLinks(found);
    setListState('ready');
  };

  const handleLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (linking) return;

    const linkedId = defectId.trim();
    const linkedUrl = defectUrl.trim();
    const linkedTitle = defectTitle.trim();

    setLinking(true);
    try {
      await client.linkResultDefect(runId, caseId, {
        defectId: linkedId,
        defectUrl: linkedUrl,
        trackerType,
        ...(linkedTitle ? { title: linkedTitle } : {}),
      });
      // The form is cleared and the list re-read, so what is shown is the API's
      // answer rather than a local echo of the submitted link.
      setDefectId('');
      setDefectUrl('');
      setDefectTitle('');
      try {
        await refresh();
      } catch (error) {
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setListFailure(failure);
        setListState('error');
      }
      setAnnouncement(`Linked defect ${linkedId} to ${caseId}.`);
      onStatus(`Linked defect ${linkedId} to ${caseId} in ${runId}.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      setAnnouncement(`Could not link the defect: ${failure.message}`);
      onStatus(`Could not link the defect: ${failure.message}`, 'error');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (link: DefectLink) => {
    if (unlinking) return;

    setUnlinking(link.linkId);
    try {
      await client.unlinkResultDefect(runId, caseId, link.linkId);
      try {
        await refresh();
      } catch (error) {
        const failure = toFailure(error, 'Could not reach the Tucano Test API.');
        setListFailure(failure);
        setListState('error');
      }
      setAnnouncement(`Unlinked defect ${link.defectId} from ${caseId}.`);
      onStatus(`Unlinked defect ${link.defectId} from ${caseId} in ${runId}.`);
    } catch (error) {
      const failure = toFailure(error, 'The API refused the request.');
      setAnnouncement(`Could not unlink the defect: ${failure.message}`);
      onStatus(`Could not unlink the defect: ${failure.message}`, 'error');
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <section
      aria-label={`Defect links for ${caseId}`}
      style={{
        marginTop: '16px',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        background: '#ffffff',
      }}
    >
      <h5 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
        Linked defects ({links.length})
      </h5>

      {/* Linking and unlinking are asynchronous, so both outcomes are announced. */}
      <p aria-live="polite" style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: '#475569' }}>
        {announcement}
      </p>

      {listState === 'loading' && <p className="module-state">Fetching linked defects…</p>}

      {listState === 'error' && listFailure && (
        <div className="module-error">
          <p>Could not load linked defects: {listFailure.message}</p>
          <p className="module-error-code">Error code: {listFailure.code}</p>
        </div>
      )}

      {listState === 'ready' && links.length === 0 && (
        <p className="module-state">No defects linked to this result.</p>
      )}

      {listState === 'ready' && links.length > 0 && (
        <ul style={{ margin: '0 0 12px 0', paddingLeft: '18px', fontSize: '13px', color: '#475569' }}>
          {links.map((link) => {
            const href = safeHref(link.defectUrl);
            return (
              <li key={link.linkId} style={{ marginBottom: '6px' }}>
                {href ? (
                  <a href={href}>{link.title ?? link.defectId}</a>
                ) : (
                  <span>{link.title ?? link.defectId}</span>
                )}
                <span>
                  {' '}
                  — {link.defectId} in {link.trackerType}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  aria-label={`Unlink defect ${link.defectId}`}
                  disabled={unlinking !== null}
                  style={{ marginLeft: '8px', fontSize: '12px' }}
                  onClick={() => void handleUnlink(link)}
                >
                  Unlink
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form className="form-grid" onSubmit={handleLink}>
        <div className="form-group">
          <label htmlFor={`${fieldId}-tracker`}>Tracker</label>
          <select
            id={`${fieldId}-tracker`}
            value={trackerType}
            onChange={(event) => setTrackerType(event.target.value as DefectTrackerType)}
          >
            {DEFECT_TRACKER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-id`}>Defect ID</label>
          <input
            id={`${fieldId}-id`}
            type="text"
            required
            value={defectId}
            onChange={(event) => setDefectId(event.target.value)}
            placeholder="e.g. PROJ-42"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-url`}>Defect URL</label>
          <input
            id={`${fieldId}-url`}
            type="url"
            required
            value={defectUrl}
            onChange={(event) => setDefectUrl(event.target.value)}
            placeholder="https://example.atlassian.net/browse/PROJ-42"
          />
        </div>
        <div className="form-group">
          <label htmlFor={`${fieldId}-title`}>Title (optional)</label>
          <input
            id={`${fieldId}-title`}
            type="text"
            value={defectTitle}
            onChange={(event) => setDefectTitle(event.target.value)}
          />
        </div>
        <button type="submit" disabled={linking}>
          Link defect
        </button>
      </form>
    </section>
  );
}
