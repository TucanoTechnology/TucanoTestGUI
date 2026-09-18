import { useId, useState, type FormEvent } from "react";
import type { ApiErrorInfo } from "../api/errors.js";
import { ApiErrorNotice } from "./ApiErrorNotice.js";
import { isJsonKeyName, toJsonKey } from "./keys.js";
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
  /**
   * What the API calls the resource this form creates, when it derives that
   * resource's key from the name (`<name>.json`). Set on a create form only: an
   * edit form sends a name to a route that already holds the key.
   */
  derivedIdLabel?: string;
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
  derivedIdLabel,
  onSubmit,
  onCancel,
}: EntityFormProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [tags, setTags] = useState(initialValues?.tags?.join(", ") ?? "");

  const trimmedName = name.trim();
  const nameHint =
    derivedIdLabel === undefined
      ? null
      : `The new ${derivedIdLabel}'s ID is this name with .json appended, such as “checkout.json” for “checkout”. An ID is a single path component ending in .json, so it cannot contain “/”.`;
  // The API derives the key from the name, so a name carrying the path
  // separator would come back as an `invalid_id` the user cannot act on. Only
  // the one thing the contract states is checked here; every other refusal
  // still reads from the API's own envelope.
  const nameError =
    nameHint === null || trimmedName === "" || isJsonKeyName(trimmedName)
      ? null
      : `This name would derive the ID “${toJsonKey(trimmedName)}”, which is not a single path component. An ID cannot contain “/”.`;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // The submit button is disabled while the name cannot work, but a form can
    // be submitted without it.
    if (!trimmedName || nameError !== null) return;
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
          aria-invalid={nameError === null ? undefined : true}
          aria-describedby={
            nameHint === null
              ? undefined
              : nameError === null
                ? `${fieldId}-name-hint`
                : `${fieldId}-name-error`
          }
        />
        {nameHint !== null &&
          (nameError === null ? (
            <p className="form-field__hint" id={`${fieldId}-name-hint`}>
              {nameHint}
            </p>
          ) : (
            <p
              className="form-field__hint"
              id={`${fieldId}-name-error`}
              role="alert"
            >
              {nameError}
            </p>
          ))}
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
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || nameError !== null}
        >
          {busy ? `${submitLabel}…` : submitLabel}
        </button>
      </div>
    </form>
  );
}
