import { useId, useState, type FormEvent } from "react";
import type { TestCase } from "../../api/generated/index.js";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { parseTags } from "../../app/tags.js";

export type CasePriority = NonNullable<TestCase["priority"]>;
export type CaseSeverity = NonNullable<TestCase["severity"]>;

export const CASE_PRIORITIES: CasePriority[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

export const CASE_SEVERITIES: CaseSeverity[] = [
  "Trivial",
  "Minor",
  "Major",
  "Critical",
];

export interface CaseFormValues {
  testCaseId: string;
  title: string;
  expectedResult: string;
  description: string;
  preconditions: string;
  /** An empty string leaves the field out of the request body. */
  priority: CasePriority | "";
  /** An empty string leaves the field out of the request body. */
  severity: CaseSeverity | "";
  tags: string[];
}

interface CaseFormProps {
  submitLabel: string;
  /**
   * The case being edited. The identifier is shown but never offered for edit:
   * the API addresses a case by it, so renaming would leave the parents that
   * hold the old one behind. Absent when creating, where it is asked for.
   */
  caseId?: string;
  initialValues?: Partial<Omit<CaseFormValues, "testCaseId">>;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  onSubmit: (values: CaseFormValues) => void;
  onCancel: () => void;
}

export function CaseForm({
  submitLabel,
  caseId,
  initialValues,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: CaseFormProps) {
  const fieldId = useId();
  const [testCaseId, setTestCaseId] = useState("");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [expectedResult, setExpectedResult] = useState(
    initialValues?.expectedResult ?? "",
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [preconditions, setPreconditions] = useState(
    initialValues?.preconditions ?? "",
  );
  const [priority, setPriority] = useState<CasePriority | "">(
    initialValues?.priority ?? "",
  );
  const [severity, setSeverity] = useState<CaseSeverity | "">(
    initialValues?.severity ?? "",
  );
  const [tags, setTags] = useState(initialValues?.tags?.join(", ") ?? "");

  // The API keeps a priority and a severity it has already stored, so offering
  // an empty choice next to a stored value would only promise a clear the API
  // cannot perform. It is offered while the field is empty, where it holds.
  const priorityOptional = !initialValues?.priority;
  const severityOptional = !initialValues?.severity;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedExpected = expectedResult.trim();
    const trimmedId = testCaseId.trim();
    if (!trimmedTitle || !trimmedExpected) return;
    if (!caseId && !trimmedId) return;
    onSubmit({
      testCaseId: caseId ?? trimmedId,
      title: trimmedTitle,
      expectedResult: trimmedExpected,
      description: description.trim(),
      preconditions: preconditions.trim(),
      priority,
      severity,
      tags: parseTags(tags),
    });
  };

  return (
    <form
      className="case-form"
      onSubmit={handleSubmit}
      aria-label={`${submitLabel} form`}
    >
      {error && <ApiErrorNotice error={error} />}

      {caseId ? (
        <p className="form-field__hint">
          Case ID: {caseId}. The identifier is fixed, and the API addresses the
          case by it.
        </p>
      ) : (
        <div className="form-field">
          <label htmlFor={`${fieldId}-id`}>Case ID</label>
          <input
            id={`${fieldId}-id`}
            type="text"
            value={testCaseId}
            onChange={(event) => setTestCaseId(event.target.value)}
            required
            aria-required="true"
            aria-describedby={`${fieldId}-id-hint`}
          />
          <p className="form-field__hint" id={`${fieldId}-id-hint`}>
            An identifier such as TC-LOGIN-3. It is fixed once created.
          </p>
        </div>
      )}

      <div className="form-field">
        <label htmlFor={`${fieldId}-title`}>Title</label>
        <input
          id={`${fieldId}-title`}
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          aria-required="true"
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-expected`}>Expected result</label>
        <textarea
          id={`${fieldId}-expected`}
          rows={2}
          value={expectedResult}
          onChange={(event) => setExpectedResult(event.target.value)}
          required
          aria-required="true"
        />
      </div>

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
        <label htmlFor={`${fieldId}-preconditions`}>Preconditions</label>
        <textarea
          id={`${fieldId}-preconditions`}
          rows={2}
          value={preconditions}
          onChange={(event) => setPreconditions(event.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-priority`}>Priority</label>
        <select
          id={`${fieldId}-priority`}
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as CasePriority | "")
          }
        >
          {priorityOptional && <option value="">Not set</option>}
          {CASE_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-severity`}>Severity</label>
        <select
          id={`${fieldId}-severity`}
          value={severity}
          onChange={(event) =>
            setSeverity(event.target.value as CaseSeverity | "")
          }
        >
          {severityOptional && <option value="">Not set</option>}
          {CASE_SEVERITIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-tags`}>Tags</label>
        <input
          id={`${fieldId}-tags`}
          type="text"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          aria-describedby={`${fieldId}-tags-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-tags-hint`}>
          Separate tags with commas.
        </p>
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
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? `${submitLabel}…` : submitLabel}
        </button>
      </div>
    </form>
  );
}
