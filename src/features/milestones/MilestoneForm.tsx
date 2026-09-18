import { useId, useState, type FormEvent } from "react";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import type {
  MilestoneRunOption,
  MilestoneSuiteOption,
} from "./milestoneSelection.js";

export interface MilestoneFormValues {
  name: string;
  description: string;
  status: string;
  startDate: string;
  targetDate: string;
  /** An empty string derives the identifier from the name. */
  milestoneId: string;
  suiteIds: string[];
  runIds: string[];
}

interface MilestoneFormProps {
  submitLabel: string;
  initialValues?: Partial<Omit<MilestoneFormValues, "milestoneId">>;
  /**
   * The suites and runs a milestone can link. Omitted while the links are
   * unknown, so the form never offers an empty set as if it were the truth.
   */
  suiteOptions?: MilestoneSuiteOption[];
  runOptions?: MilestoneRunOption[];
  /**
   * Ask for an identifier. Only the create form does: the API stores a body
   * identifier into the document without moving the milestone, so an edit must
   * never send one.
   */
  idField?: boolean;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  onSubmit: (values: MilestoneFormValues) => void;
  onCancel: () => void;
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((entry) => entry !== id)
    : [...ids, id];
}

export function MilestoneForm({
  submitLabel,
  initialValues,
  suiteOptions,
  runOptions,
  idField = false,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: MilestoneFormProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [milestoneId, setMilestoneId] = useState("");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [status, setStatus] = useState(initialValues?.status ?? "");
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(initialValues?.targetDate ?? "");
  const [suiteIds, setSuiteIds] = useState(initialValues?.suiteIds ?? []);
  const [runIds, setRunIds] = useState(initialValues?.runIds ?? []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return;
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      status: status.trim(),
      startDate: startDate.trim(),
      targetDate: targetDate.trim(),
      milestoneId: milestoneId.trim(),
      suiteIds,
      runIds,
    });
  };

  return (
    <form
      className="milestone-form"
      onSubmit={handleSubmit}
      aria-label={`${submitLabel} form`}
    >
      {error && <ApiErrorNotice error={error} />}

      <div className="form-field">
        <label htmlFor={`${fieldId}-name`}>Name</label>
        <input
          id={`${fieldId}-name`}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          aria-required="true"
          aria-describedby={`${fieldId}-name-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-name-hint`}>
          Renaming a milestone leaves it where it is: the API keeps addressing
          it by the key the project holds it by.
        </p>
      </div>

      {idField && (
        <div className="form-field">
          <label htmlFor={`${fieldId}-id`}>Milestone ID</label>
          <input
            id={`${fieldId}-id`}
            value={milestoneId}
            onChange={(event) => setMilestoneId(event.target.value)}
            aria-describedby={`${fieldId}-id-hint`}
          />
          <p className="form-field__hint" id={`${fieldId}-id-hint`}>
            Leave blank to derive it from the name. The API stores it as given
            and addresses the milestone by the file that holds it, so it cannot
            be changed later.
          </p>
        </div>
      )}

      <div className="form-field">
        <label htmlFor={`${fieldId}-description`}>Description</label>
        <textarea
          id={`${fieldId}-description`}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-status`}>Status</label>
        <input
          id={`${fieldId}-status`}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-describedby={`${fieldId}-status-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-status-hint`}>
          Free text, such as open, in_progress or completed. The API stores it
          without checking it against a list.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-start-date`}>Start date</label>
        <input
          id={`${fieldId}-start-date`}
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          aria-describedby={`${fieldId}-start-date-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-start-date-hint`}>
          An ISO date, such as 2026-10-01. The API stores the text as written.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-target-date`}>Target date</label>
        <input
          id={`${fieldId}-target-date`}
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
          aria-describedby={`${fieldId}-target-date-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-target-date-hint`}>
          An ISO date, such as 2026-10-31. The API stores the text as written.
        </p>
      </div>

      {suiteOptions && (
        <fieldset
          className="form-field"
          aria-describedby={`${fieldId}-suites-hint`}
        >
          <legend>Linked suites</legend>
          {suiteOptions.length === 0 ? (
            <p className="form-field__hint">
              This project holds no test suites.
            </p>
          ) : (
            <ul className="option-list">
              {suiteOptions.map((suite) => (
                <li key={suite.suiteId} className="option-list__item">
                  <label className="option">
                    <input
                      type="checkbox"
                      checked={suiteIds.includes(suite.suiteId)}
                      onChange={() =>
                        setSuiteIds((ids) => toggleId(ids, suite.suiteId))
                      }
                    />
                    <span className="option__name">{suite.name}</span>
                    <span className="option__meta">
                      {suite.caseCount} cases
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="form-field__hint" id={`${fieldId}-suites-hint`}>
            A milestone reaches a project through the suites and runs it links.
          </p>
        </fieldset>
      )}

      {runOptions && (
        <fieldset className="form-field" aria-describedby={`${fieldId}-runs-hint`}>
          <legend>Linked runs</legend>
          {runOptions.length === 0 ? (
            <p className="form-field__hint">
              This project holds no test runs.
            </p>
          ) : (
            <ul className="option-list">
              {runOptions.map((run) => (
                <li key={run.id} className="option-list__item">
                  <label className="option">
                    <input
                      type="checkbox"
                      checked={runIds.includes(run.id)}
                      onChange={() =>
                        setRunIds((ids) => toggleId(ids, run.id))
                      }
                    />
                    <span className="option__name">{run.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="form-field__hint" id={`${fieldId}-runs-hint`}>
            The progress view counts the results the linked runs recorded.
          </p>
        </fieldset>
      )}

      <div className="dialog__actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? `${submitLabel}…` : submitLabel}
        </button>
      </div>
    </form>
  );
}
