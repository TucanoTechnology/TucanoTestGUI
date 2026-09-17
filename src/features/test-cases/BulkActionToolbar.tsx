import { useEffect, useRef, useState } from 'react';
import { STATUS_CONFIG, VALID_STATUSES, TestCaseStatus } from '../../components/StatusBadge';

/**
 * Bulk action bar for a multi-row selection in the Test Cases execution board.
 *
 * The module owns the selection and performs the mutations through
 * TucanoApiClient; this component only renders the controls. The selection size
 * is announced so it is always clear how many cases a bulk action will touch,
 * and the destructive action stays behind an explicit confirmation.
 */

export interface BulkActionToolbarProps {
  selectedCount: number;
  onStatusChange: (status: TestCaseStatus) => void;
  onDelete: () => void;
  onClear: () => void;
  busy?: boolean;
}

/** 'Untested' resets a case, so it is not offered as a bulk outcome. */
const BULK_STATUSES = VALID_STATUSES.filter((status) => status !== 'Untested');

export default function BulkActionToolbar({
  selectedCount,
  onStatusChange,
  onDelete,
  onClear,
  busy = false,
}: BulkActionToolbarProps) {
  const [confirming, setConfirming] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedCount === 0) {
      setConfirming(false);
    }
  }, [selectedCount]);

  useEffect(() => {
    if (confirming) {
      cancelRef.current?.focus();
    }
  }, [confirming]);

  if (selectedCount === 0) {
    return null;
  }

  const caseWord = selectedCount === 1 ? 'case' : 'cases';

  return (
    <>
      <div className="table-toolbar">
        <div className="table-toolbar-group">
          <p role="status" aria-live="polite">
            {selectedCount} {caseWord} selected
          </p>
        </div>
        <div className="table-toolbar-group">
          {BULK_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="btn-quiet"
              disabled={busy}
              onClick={() => onStatusChange(status)}
            >
              Mark {STATUS_CONFIG[status].label.toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Delete selected
          </button>
          <button type="button" className="btn-secondary" onClick={onClear}>
            Clear selection
          </button>
        </div>
      </div>

      {confirming && (
        <div
          className="delete-confirm"
          role="group"
          aria-label={`Confirm deletion of ${selectedCount} ${caseWord}`}
        >
          <p>
            Delete {selectedCount} selected {caseWord}? This cannot be undone.
          </p>
          <div>
            <button
              type="button"
              className="btn-secondary"
              ref={cancelRef}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
            >
              Confirm delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
