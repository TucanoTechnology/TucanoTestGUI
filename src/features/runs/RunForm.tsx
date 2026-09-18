import { useId, useState, type FormEvent } from "react";
import type {
  TestConfiguration,
  TestSuite,
} from "../../api/generated/index.js";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import type { RunCaseOption } from "./runSelection.js";

export interface RunFormValues {
  name: string;
  tags: string[];
  /** The linked configuration, or `""` for none. */
  configId: string;
  suiteIds: string[];
  caseIds: string[];
}

interface RunFormProps {
  submitLabel: string;
  initialValues?: Partial<RunFormValues>;
  /**
   * The suites and cases a run can cover. Omitted when the run already holds
   * its snapshot, because a stored run never re-reads the cases it pinned.
   */
  suiteOptions?: TestSuite[];
  caseOptions?: RunCaseOption[];
  configurationOptions?: TestConfiguration[];
  busy?: boolean;
  error?: ApiErrorInfo | null;
  onSubmit: (values: RunFormValues) => void;
  onCancel: () => void;
}

/** A comma-separated tag field, trimmed and stripped of empty entries. */
function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id)
    ? ids.filter((entry) => entry !== id)
    : [...ids, id];
}

export function RunForm({
  submitLabel,
  initialValues,
  suiteOptions,
  caseOptions,
  configurationOptions,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: RunFormProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [tags, setTags] = useState((initialValues?.tags ?? []).join(", "));
  const [configId, setConfigId] = useState(initialValues?.configId ?? "");
  const [suiteIds, setSuiteIds] = useState(initialValues?.suiteIds ?? []);
  const [caseIds, setCaseIds] = useState(initialValues?.caseIds ?? []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return;
    onSubmit({
      name: trimmedName,
      tags: parseTags(tags),
      configId,
      suiteIds,
      caseIds,
    });
  };

  return (
    <form
      className="run-form"
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
          The name also addresses the run, so it cannot be changed without
          storing a new one.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-tags`}>Tags</label>
        <input
          id={`${fieldId}-tags`}
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          aria-describedby={`${fieldId}-tags-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-tags-hint`}>
          Separate tags with commas.
        </p>
      </div>

      {configurationOptions && (
        <div className="form-field">
          <label htmlFor={`${fieldId}-configuration`}>Configuration</label>
          <select
            id={`${fieldId}-configuration`}
            value={configId}
            onChange={(event) => setConfigId(event.target.value)}
            aria-describedby={`${fieldId}-configuration-hint`}
          >
            <option value="">None</option>
            {configurationOptions.map((configuration) => (
              <option
                key={configuration.configId}
                value={configuration.configId}
              >
                {configuration.name}
              </option>
            ))}
          </select>
          <p className="form-field__hint" id={`${fieldId}-configuration-hint`}>
            A run links at most one configuration.
          </p>
        </div>
      )}

      {suiteOptions && (
        <fieldset
          className="form-field"
          aria-describedby={`${fieldId}-suites-hint`}
        >
          <legend>Test suites</legend>
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
                      {suite.testCases?.length ?? 0} cases
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="form-field__hint" id={`${fieldId}-suites-hint`}>
            A selected suite is copied into the run with the cases it holds.
          </p>
        </fieldset>
      )}

      {caseOptions && (
        <fieldset
          className="form-field"
          aria-describedby={`${fieldId}-cases-hint`}
        >
          <legend>Test cases</legend>
          {caseOptions.length === 0 ? (
            <p className="form-field__hint">This project holds no test cases.</p>
          ) : (
            <ul className="option-list">
              {caseOptions.map((option) => (
                <li
                  key={option.testCase.testCaseId}
                  className="option-list__item"
                >
                  <label className="option">
                    <input
                      type="checkbox"
                      checked={caseIds.includes(option.testCase.testCaseId)}
                      onChange={() =>
                        setCaseIds((ids) =>
                          toggleId(ids, option.testCase.testCaseId),
                        )
                      }
                    />
                    <span className="option__name">{option.testCase.title}</span>
                    {option.source && (
                      <span className="option__meta">in {option.source}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="form-field__hint" id={`${fieldId}-cases-hint`}>
            A selected case is copied into the run and pinned to the revision
            shown here.
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
