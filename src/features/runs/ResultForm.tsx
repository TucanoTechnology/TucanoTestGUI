import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { DefectLink } from "../../api/generated/index.js";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import {
  RESULT_STATUSES,
  formatDurationSeconds,
  parseDurationSeconds,
  type ResultRow,
  type ResultStatus,
  type ResultSubmission,
} from "./results.js";

export interface DefectLinkValues {
  trackerType: DefectLink["trackerType"];
  defectId: string;
  defectUrl: string;
}

const TRACKER_TYPES: DefectLink["trackerType"][] = [
  "jira",
  "github",
  "gitlab",
  "custom",
];

interface ResultFormProps {
  row: ResultRow;
  /**
   * The case's defect links (#460), fetched by the parent from the defect
   * route: the list belongs to the case, not to this run's result, so the
   * run document no longer carries it. `null` while it loads.
   */
  defects: DefectLink[] | null;
  defectsError?: ApiErrorInfo | null;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  /** `advance` is the "Pass & next" flag: the parent moves to the next case
   * instead of closing, once the record lands (#184). */
  onSubmit: (values: ResultSubmission, advance: boolean) => void;
  /** Resolves `true` once the defect is linked, so the form can clear itself. */
  onLinkDefect: (values: DefectLinkValues) => Promise<boolean>;
  onUnlinkDefect: (linkId: string) => Promise<boolean>;
  onCancel: () => void;
}

export function ResultForm({
  row,
  defects,
  defectsError = null,
  busy = false,
  error = null,
  onSubmit,
  onLinkDefect,
  onUnlinkDefect,
  onCancel,
}: ResultFormProps) {
  const fieldId = useId();
  const existing = row.result;
  const submitLabel = existing ? "Save result" : "Record result";
  const [status, setStatus] = useState<ResultStatus>(
    RESULT_STATUSES.find((value) => value === existing?.status) ?? "Untested",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [duration, setDuration] = useState(
    formatDurationSeconds(existing?.durationMs),
  );
  const [durationError, setDurationError] = useState<string | null>(null);
  const [trackerType, setTrackerType] =
    useState<DefectLink["trackerType"]>("jira");
  const [defectId, setDefectId] = useState("");
  const [defectUrl, setDefectUrl] = useState("");

  // Set by the Pass & next button just before it submits, read by
  // handleSubmit: the flag rides the same validation, so the duration rules
  // never differ between the two ways out (#184).
  const advanceOnSubmit = useRef(false);

  // The form's first field takes focus when it opens — including when "Pass
  // & next" remounts it on the following case, which is the whole point of
  // the transition (#184, matching the shell's focus discipline).
  const statusRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    statusRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseDurationSeconds(duration);
    if (parsed.error !== null) {
      setDurationError(parsed.error);
      return;
    }
    setDurationError(null);
    // Pass & next records a pass whatever the form carries: the button is
    // the tester saying "it works, move on", so the status is the promise,
    // not the (possibly stale) select value (#184).
    onSubmit(
      {
        status: advanceOnSubmit.current ? "Passed" : status,
        notes,
        durationMs: parsed.durationMs,
      },
      advanceOnSubmit.current,
    );
    advanceOnSubmit.current = false;
  };

  const handleLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = defectId.trim();
    const url = defectUrl.trim();
    if (id.length === 0 || url.length === 0) return;
    const linked = await onLinkDefect({
      trackerType,
      defectId: id,
      defectUrl: url,
    });
    if (!linked) return;
    setDefectId("");
    setDefectUrl("");
  };

  const linkReady = defectId.trim().length > 0 && defectUrl.trim().length > 0;

  return (
    <>
      {error && <ApiErrorNotice error={error} />}

      <p className="form-field__hint">
        Case ID: {row.testCaseId}
        {row.title ? `. ${row.title}` : ""}
      </p>

      <form
        className="run-form"
        onSubmit={handleSubmit}
        aria-label={`${submitLabel} form`}
      >
        <div className="form-field">
          <label htmlFor={`${fieldId}-status`}>Status</label>
          <select
            ref={statusRef}
            id={`${fieldId}-status`}
            value={status}
            onChange={(event) => setStatus(event.target.value as ResultStatus)}
          >
            {RESULT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor={`${fieldId}-notes`}>Comment</label>
          <textarea
            id={`${fieldId}-notes`}
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor={`${fieldId}-duration`}>Duration (seconds)</label>
          <input
            id={`${fieldId}-duration`}
            type="text"
            inputMode="decimal"
            value={duration}
            onChange={(event) => {
              setDuration(event.target.value);
              setDurationError(null);
            }}
            aria-invalid={durationError === null ? undefined : true}
            aria-describedby={
              durationError === null
                ? `${fieldId}-duration-hint`
                : `${fieldId}-duration-error`
            }
          />
          {durationError === null ? (
            <p className="form-field__hint" id={`${fieldId}-duration-hint`}>
              How long the case took, in seconds. Leave it blank when it was not
              timed.
            </p>
          ) : (
            <p
              className="form-field__hint"
              id={`${fieldId}-duration-error`}
              role="alert"
            >
              {durationError}
            </p>
          )}
        </div>

        <div className="dialog__actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
          >
            {busy ? `${submitLabel}…` : submitLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            title="Record Passed and open the next case awaiting execution"
            onClick={(event) => {
              advanceOnSubmit.current = true;
              event.currentTarget.closest("form")?.requestSubmit();
            }}
          >
            Pass &amp; next
          </button>
        </div>
      </form>

      {existing && (
        <section className="detail-field" aria-labelledby={`${fieldId}-defects`}>
          <h3 className="detail-field__label" id={`${fieldId}-defects`}>
            Linked defects{defects === null ? "" : ` (${defects.length})`}
          </h3>
          {defectsError && <ApiErrorNotice error={defectsError} />}
          {defects === null && (
            <p className="form-field__hint" role="status">
              Loading the case&apos;s defect links…
            </p>
          )}
          {defects !== null && defects.length > 0 && (
            <ul className="entity-list">
              {defects!.map((defect) => (
                <li key={defect.linkId} className="entity-list__item">
                  <span className="entity-list__name">{defect.defectId}</span>
                  <span className="entity-list__meta">{defect.trackerType}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      void onUnlinkDefect(defect.linkId);
                    }}
                    disabled={busy}
                  >
                    Unlink {defect.defectId}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="run-form"
            onSubmit={handleLink}
            aria-label="Link defect form"
          >
            <div className="form-field">
              <label htmlFor={`${fieldId}-tracker`}>Tracker</label>
              <select
                id={`${fieldId}-tracker`}
                value={trackerType}
                onChange={(event) =>
                  setTrackerType(event.target.value as DefectLink["trackerType"])
                }
              >
                {TRACKER_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor={`${fieldId}-defect-id`}>Defect ID</label>
              <input
                id={`${fieldId}-defect-id`}
                type="text"
                value={defectId}
                onChange={(event) => setDefectId(event.target.value)}
                aria-describedby={`${fieldId}-defect-id-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-defect-id-hint`}>
                The key the tracker issues, such as OPS-1. A defect the result
                already links is refused rather than linked twice.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor={`${fieldId}-defect-url`}>Defect URL</label>
              <input
                id={`${fieldId}-defect-url`}
                type="text"
                value={defectUrl}
                onChange={(event) => setDefectUrl(event.target.value)}
                aria-describedby={`${fieldId}-defect-url-hint`}
              />
              <p className="form-field__hint" id={`${fieldId}-defect-url-hint`}>
                The page the tracker serves. Jira expects
                https://&lt;org&gt;.atlassian.net/browse/&lt;KEY&gt;.
              </p>
            </div>

            <div className="dialog__actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || !linkReady}
              >
                {busy ? "Linking…" : "Link defect"}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
