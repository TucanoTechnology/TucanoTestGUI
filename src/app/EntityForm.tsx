import { useId, useState, type FormEvent } from "react";
import type { ApiErrorInfo } from "../api/errors.js";
import { ApiErrorNotice } from "./ApiErrorNotice.js";
import { parseTags } from "./tags.js";

export interface EntityFormValues {
  name: string;
  description: string;
  tags: string[];
}

interface EntityFormProps {
  /** Wording the submit button carries, e.g. "Create suite". */
  submitLabel: string;
  initialValues?: Partial<EntityFormValues>;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  onSubmit: (values: EntityFormValues) => void;
  onCancel: () => void;
}

/**
 * The name, description and tags form a project and a test suite are both
 * created and edited with: the two documents carry the same three fields.
 *
 * Neither document carries its identifier in a form: a project id is chosen at
 * creation only, and the API writes a suite `suiteId` into the document without
 * moving the suite, so offering one would corrupt the resource.
 */
export function EntityForm({
  submitLabel,
  initialValues,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [tags, setTags] = useState(initialValues?.tags?.join(", ") ?? "");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      description: description.trim(),
      tags: parseTags(tags),
    });
  };

  return (
    <form
      className="entity-form"
      onSubmit={handleSubmit}
      aria-label={`${submitLabel} form`}
    >
      {error && <ApiErrorNotice error={error} />}

      <div className="form-field">
        <label htmlFor={`${fieldId}-name`}>Name</label>
        <input
          id={`${fieldId}-name`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
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
