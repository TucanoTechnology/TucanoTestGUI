import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { apiErrorEnvelope, createApiClient, type ApiErrorEnvelope } from '../api/configure';

/**
 * Tags for one entity — issue #62.
 *
 * The API owns the list: nothing is derived here, and every write is followed
 * by a re-read of the entity, so what is rendered is what the API holds.
 *
 * Both the read and the write go through the generated client. The legacy
 * `TucanoApiClient` types carry no `tags` field at all, and `updateProject` /
 * `updateTestSuite` / `updateTestCase` / `updateTestRun` are documented partial
 * updates — "the fields supplied replace the stored field and every other
 * stored field is kept" — so a body carrying `tags` alone replaces the tags and
 * leaves the entity's other fields exactly as they are. That is what #62 asks
 * for ("send the full entity fields the form already manages plus the new
 * tags") without echoing a legacy-shaped document back through a contract that
 * rejects unknown fields.
 *
 * Milestones are not taggable: the contract's `Milestone` carries no `tags`.
 */

/** The four entities whose contract carries `tags`. */
export type TaggedItemType = 'case' | 'suite' | 'project' | 'run';

type TagsState = 'loading' | 'ready' | 'error';

/** Wording for a failure that carried no envelope (transport failure). */
const API_UNREACHABLE = 'the API could not be reached.';

/**
 * Reads the comma-separated form the contract asks for into the array the API
 * stores: blanks are dropped and a repeated tag is kept once, so a chip list
 * never renders the same tag twice.
 */
export function parseTags(input: string): string[] {
  const tags: string[] = [];
  for (const part of input.split(',')) {
    const tag = part.trim();
    if (tag !== '' && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}

/** The comma-separated form of the array the API reported, for the input. */
export function formatTags(tags: readonly string[] | undefined): string {
  return (tags ?? []).join(', ');
}

export interface EntityTagsProps {
  resourceType: TaggedItemType;
  resourceId: string;
}

export default function EntityTags({ resourceType, resourceId }: EntityTagsProps) {
  const api = useMemo(() => createApiClient(), []);
  const headingId = useId();
  const inputId = useId();

  const [state, setState] = useState<TagsState>('loading');
  const [tags, setTags] = useState<string[]>([]);
  const [loadFailure, setLoadFailure] = useState<ApiErrorEnvelope | null>(null);
  const [saveFailure, setSaveFailure] = useState<ApiErrorEnvelope | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const readTags = useCallback(async () => {
    switch (resourceType) {
      case 'case':
        return (await api.testCases.getTestCase({ id: resourceId })).tags ?? [];
      case 'suite':
        return (await api.testSuites.getTestSuite({ id: resourceId })).tags ?? [];
      case 'project':
        return (await api.projects.getProject({ id: resourceId })).tags ?? [];
      case 'run':
        return (await api.testRuns.getTestRun({ id: resourceId })).tags ?? [];
    }
  }, [api, resourceType, resourceId]);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setLoadFailure(null);
    setSaveFailure(null);

    void (async () => {
      try {
        const stored = await readTags();
        if (cancelled) return;
        setTags(stored);
        setDraft(formatTags(stored));
        setState('ready');
        setAnnouncement(
          stored.length === 1 ? 'Loaded 1 tag.' : `Loaded ${stored.length} tags.`,
        );
      } catch (error) {
        if (cancelled) return;
        const envelope = apiErrorEnvelope(error);
        setTags([]);
        setLoadFailure(envelope);
        setState('error');
        setAnnouncement(`Could not load the tags: ${envelope?.message ?? API_UNREACHABLE}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readTags]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = parseTags(draft);

    setIsSaving(true);
    setSaveFailure(null);
    setAnnouncement('Saving tags…');
    try {
      if (resourceType === 'case') {
        await api.testCases.updateTestCase({ id: resourceId, requestBody: { tags: next } });
      } else if (resourceType === 'suite') {
        await api.testSuites.updateTestSuite({ id: resourceId, requestBody: { tags: next } });
      } else if (resourceType === 'project') {
        await api.projects.updateProject({ id: resourceId, requestBody: { tags: next } });
      } else {
        await api.testRuns.updateTestRun({ id: resourceId, requestBody: { tags: next } });
      }

      // The update answers with a message only, so the stored tags are read back.
      const stored = await readTags();
      setTags(stored);
      setDraft(formatTags(stored));
      setAnnouncement(stored.length === 1 ? 'Saved 1 tag.' : `Saved ${stored.length} tags.`);
    } catch (error) {
      const envelope = apiErrorEnvelope(error);
      setSaveFailure(envelope);
      setAnnouncement(`Could not save the tags: ${envelope?.message ?? API_UNREACHABLE}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="tag-section" aria-labelledby={headingId}>
      <h4 className="tag-heading" id={headingId}>
        Tags
      </h4>

      <p className="status-bar-announcement" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {state === 'loading' && <p className="module-state">Loading tags…</p>}

      {state === 'error' && (
        <div className="module-error">
          <p>Could not load the tags: {loadFailure?.message ?? API_UNREACHABLE}</p>
          <p className="module-error-code">Error code: {loadFailure?.code ?? 'network_error'}</p>
        </div>
      )}

      {state === 'ready' && (
        <div>
          {saveFailure && (
            <div className="module-error">
              <p>{saveFailure.message}</p>
              <p className="module-error-code">Error code: {saveFailure.code}</p>
            </div>
          )}

          {tags.length === 0 ? (
            <p className="module-state">No tags</p>
          ) : (
            <ul className="tag-list">
              {tags.map((tag) => (
                <li className="tag-chip" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <form className="tag-editor" onSubmit={handleSubmit}>
            <label htmlFor={inputId}>Tags (comma-separated)</label>
            <input
              id={inputId}
              type="text"
              value={draft}
              placeholder="smoke, regression"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save tags'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
