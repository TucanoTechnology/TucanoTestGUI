/**
 * Inline detail preview (issue #76).
 *
 * The panel is the contextual surface that replaced the modal detail view: a
 * labelled, non-modal region that sits next to the list that selected the
 * entity. The owning module keeps the selection and owns every mutation, so the
 * panel holds no state of its own, never calls the API, and can only render what
 * the API already returned through the module.
 */

export interface PreviewField {
  label: string;
  value: string;
}

export interface PreviewLinkList {
  heading: string;
  /** Pre-formatted entries; the owning module knows the entity's shape. */
  entries: readonly string[];
}

export interface PreviewFailure {
  code: string;
  message: string;
}

export type PreviewState = 'empty' | 'loading' | 'ready' | 'error';

export interface DetailPreviewPanelProps {
  /** Accessible name of the region, e.g. "Project details preview". */
  label: string;
  /** Visible heading: the entity being previewed, or a neutral title. */
  heading: string;
  state: PreviewState;
  /** The API error envelope, surfaced verbatim. */
  failure?: PreviewFailure | null;
  fields?: readonly PreviewField[];
  linkLists?: readonly PreviewLinkList[];
  /** Shown instead of the fields while the list has no selection. */
  emptyHint?: string;
  /** Clears the module's selection; offered in every state. */
  onClose: () => void;
  /** Opens the owning module's edit form for the previewed entity. */
  onEdit?: () => void;
  /** Only offered by modules that can copy the entity today. */
  onDuplicate?: () => void;
  /** Hands off to the module, which asks for confirmation in the list. */
  onDelete?: () => void;
}

const DEFAULT_EMPTY_HINT = 'Select an item in the list to preview it here.';

/**
 * Screen-reader-only, because the region's heading already carries the same
 * information visually; only the change is worth speaking.
 */
const ANNOUNCEMENT_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  margin: '-1px',
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export default function DetailPreviewPanel({
  label,
  heading,
  state,
  failure,
  fields,
  linkLists,
  emptyHint = DEFAULT_EMPTY_HINT,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: DetailPreviewPanelProps) {
  // Selection changes are spoken. The panel is not a dialog, so focus is never
  // taken away from the control the tester activated.
  const announcement =
    state === 'loading'
      ? `Loading details for ${heading}.`
      : state === 'error'
        ? `Could not load details for ${heading}.`
        : state === 'ready'
          ? `Showing details for ${heading}.`
          : 'No item selected.';

  return (
    <section className="panel-column" aria-label={label} style={{ flex: '0 0 340px' }}>
      <div className="panel-header">
        <h2>{heading}</h2>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close preview
        </button>
      </div>

      <p aria-live="polite" style={ANNOUNCEMENT_STYLE}>
        {announcement}
      </p>

      <div className="tree-scroll">
        {state === 'empty' && <p className="module-state">{emptyHint}</p>}
        {state === 'loading' && <p className="module-state">Fetching details…</p>}

        {state === 'error' && failure && (
          <div className="module-error">
            <p>Could not load details: {failure.message}</p>
            <p className="module-error-code">Error code: {failure.code}</p>
          </div>
        )}

        {state === 'ready' && (
          <div>
            {(fields ?? []).map((field) => (
              <p
                key={field.label}
                style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}
              >
                <strong>{field.label}:</strong> {field.value}
              </p>
            ))}

            {(linkLists ?? []).map((list) => (
              <div key={list.heading} style={{ marginTop: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '13.5px' }}>
                  {list.heading} ({list.entries.length})
                </h3>
                {list.entries.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>None linked.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#475569' }}>
                    {list.entries.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {(onEdit || onDuplicate || onDelete) && (
              <div className="entity-card-actions" style={{ marginTop: '16px' }}>
                {onEdit && (
                  <button type="button" className="btn-secondary" onClick={onEdit}>
                    Edit
                  </button>
                )}
                {onDuplicate && (
                  <button type="button" className="btn-secondary" onClick={onDuplicate}>
                    Duplicate
                  </button>
                )}
                {onDelete && (
                  <button type="button" className="btn-danger" onClick={onDelete}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
