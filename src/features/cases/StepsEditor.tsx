import { useId, useState, type FormEvent } from "react";
import type { TestStep } from "../../api/generated/index.js";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import { Dialog } from "../../app/Dialog.js";

type Editor =
  | { kind: "idle" }
  | { kind: "add" }
  | { kind: "edit"; index: number };

interface StepDraft {
  action: string;
  expectedResult: string;
}

const EMPTY_DRAFT: StepDraft = { action: "", expectedResult: "" };

interface StepsEditorProps {
  /** Stored steps: the API accepts a bare string for a step with no expectation. */
  steps: Array<string | TestStep>;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  /** Resolves true when the caller stored the given steps. */
  onSave: (steps: TestStep[]) => Promise<boolean>;
  /** Called when this editor opens, to drop an error left by an earlier action. */
  onDismissError?: () => void;
}

function normalise(step: string | TestStep): TestStep {
  return typeof step === "string" ? { action: step } : step;
}

function draftOf(step: TestStep): StepDraft {
  return { action: step.action, expectedResult: step.expectedResult ?? "" };
}

/**
 * One step rewritten from the draft. Everything else the step carries is kept:
 * an update replaces the whole array, so a dropped attachment would be a
 * deletion.
 */
function withDraft(step: TestStep, draft: StepDraft): TestStep {
  const next: TestStep = { ...step, action: draft.action.trim() };
  const expectedResult = draft.expectedResult.trim();
  if (expectedResult) {
    next.expectedResult = expectedResult;
  } else {
    delete next.expectedResult;
  }
  return next;
}

/**
 * The steps of a test case, edited in place. Every change sends the complete
 * array through `onSave`, because the API replaces the stored steps wholesale.
 */
export function StepsEditor({
  steps,
  busy = false,
  error = null,
  onSave,
  onDismissError,
}: StepsEditorProps) {
  const fieldId = useId();
  const [editor, setEditor] = useState<Editor>({ kind: "idle" });
  const [draft, setDraft] = useState<StepDraft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<number | null>(null);

  const current = steps.map(normalise);
  const editing = editor.kind !== "idle";

  const openAdd = () => {
    onDismissError?.();
    setDraft(EMPTY_DRAFT);
    setEditor({ kind: "add" });
  };

  const openEdit = (index: number) => {
    const step = current[index];
    if (!step) return;
    onDismissError?.();
    setDraft(draftOf(step));
    setEditor({ kind: "edit", index });
  };

  const closeEditor = () => {
    setEditor({ kind: "idle" });
    setDraft(EMPTY_DRAFT);
  };

  const openDelete = (index: number) => {
    onDismissError?.();
    setDeleting(index);
  };

  const closeDelete = () => {
    setDeleting(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const action = draft.action.trim();
    if (!action) return;
    const next =
      editor.kind === "edit"
        ? current.map((step, index) =>
            index === editor.index ? withDraft(step, draft) : step,
          )
        : [...current, withDraft({ action }, draft)];
    if (await onSave(next)) {
      closeEditor();
    }
  };

  const move = async (index: number, offset: number) => {
    const target = index + offset;
    const step = current[index];
    const other = current[target];
    if (!step || !other) return;
    const next = [...current];
    next[index] = other;
    next[target] = step;
    await onSave(next);
  };

  const confirmDelete = async () => {
    if (deleting === null) return;
    const next = current.filter((_, index) => index !== deleting);
    if (await onSave(next)) {
      closeDelete();
    }
  };

  const stepForm = (
    <form
      className="step-form"
      onSubmit={(event) => void submit(event)}
      aria-label={editor.kind === "edit" ? "Edit step form" : "Add step form"}
    >
      <div className="form-field">
        <label htmlFor={`${fieldId}-action`}>Action</label>
        <textarea
          id={`${fieldId}-action`}
          rows={2}
          value={draft.action}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, action: event.target.value }))
          }
          required
          aria-required="true"
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-expected`}>Expected result</label>
        <textarea
          id={`${fieldId}-expected`}
          rows={2}
          value={draft.expectedResult}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, expectedResult: event.target.value }))
          }
          aria-describedby={`${fieldId}-expected-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-expected-hint`}>
          Optional. Leave blank when the step has no expected result.
        </p>
      </div>

      <div className="dialog__actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={closeEditor}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save step"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="steps-editor">
      <div className="steps-editor__header">
        <div className="detail-field__label">Steps ({current.length})</div>
        <button
          type="button"
          className="btn btn-sm"
          onClick={openAdd}
          disabled={busy || editing}
        >
          Add step
        </button>
      </div>

      {error && deleting === null && <ApiErrorNotice error={error} />}

      {current.length === 0 ? (
        <p className="steps-editor__empty">No steps recorded.</p>
      ) : (
        <ol className="steps-list" aria-label="Test steps">
          {current.map((step, index) =>
            editor.kind === "edit" && editor.index === index ? (
              <li key={index} className="steps-list__item">
                {stepForm}
              </li>
            ) : (
              <li key={index} className="steps-list__item">
                <div className="steps-list__action">{step.action}</div>
                {step.expectedResult && (
                  <div className="steps-list__expected">
                    → {step.expectedResult}
                  </div>
                )}
                <div className="steps-list__controls">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    aria-label={`Edit step ${index + 1}`}
                    onClick={() => openEdit(index)}
                    disabled={busy || editing}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    aria-label={`Move step ${index + 1} up`}
                    onClick={() => void move(index, -1)}
                    disabled={busy || editing || index === 0}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    aria-label={`Move step ${index + 1} down`}
                    onClick={() => void move(index, 1)}
                    disabled={busy || editing || index === current.length - 1}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    aria-label={`Delete step ${index + 1}`}
                    onClick={() => openDelete(index)}
                    disabled={busy || editing}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {editor.kind === "add" && <div className="steps-editor__form">{stepForm}</div>}

      {deleting !== null && (
        <Dialog title="Delete step" onClose={closeDelete}>
          <p className="dialog__body">
            Delete step {deleting + 1} of {current.length}: “
            {current[deleting]?.action}”? The remaining steps keep their order.
          </p>

          {error && <ApiErrorNotice error={error} />}

          <div className="dialog__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={closeDelete}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void confirmDelete()}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete step"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
