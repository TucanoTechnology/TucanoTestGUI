import { useId, useState, type FormEvent } from "react";
import type { ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";

export interface ConfigurationFormValues {
  name: string;
  browser: string;
  os: string;
  device: string;
  resolution: string;
}

interface ConfigurationFormProps {
  submitLabel: string;
  initialValues?: Partial<ConfigurationFormValues>;
  busy?: boolean;
  error?: ApiErrorInfo | null;
  onSubmit: (values: ConfigurationFormValues) => void;
  onCancel: () => void;
}

export function ConfigurationForm({
  submitLabel,
  initialValues,
  busy = false,
  error = null,
  onSubmit,
  onCancel,
}: ConfigurationFormProps) {
  const fieldId = useId();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [browser, setBrowser] = useState(initialValues?.browser ?? "");
  const [os, setOs] = useState(initialValues?.os ?? "");
  const [device, setDevice] = useState(initialValues?.device ?? "");
  const [resolution, setResolution] = useState(
    initialValues?.resolution ?? "",
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return;
    onSubmit({
      name: trimmedName,
      browser: browser.trim(),
      os: os.trim(),
      device: device.trim(),
      resolution: resolution.trim(),
    });
  };

  return (
    <form
      className="configuration-form"
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
          The project lists a configuration under a key derived from its name.
          Renaming it leaves it where it is: the key cannot be changed later.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-browser`}>Browser</label>
        <input
          id={`${fieldId}-browser`}
          value={browser}
          onChange={(event) => setBrowser(event.target.value)}
          aria-describedby={`${fieldId}-browser-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-browser-hint`}>
          Free text, such as Chrome 140.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-os`}>Operating System</label>
        <input
          id={`${fieldId}-os`}
          value={os}
          onChange={(event) => setOs(event.target.value)}
          aria-describedby={`${fieldId}-os-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-os-hint`}>
          Free text, such as Windows 11.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-device`}>Device</label>
        <input
          id={`${fieldId}-device`}
          value={device}
          onChange={(event) => setDevice(event.target.value)}
          aria-describedby={`${fieldId}-device-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-device-hint`}>
          Free text, such as Desktop.
        </p>
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-resolution`}>Resolution</label>
        <input
          id={`${fieldId}-resolution`}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          aria-describedby={`${fieldId}-resolution-hint`}
        />
        <p className="form-field__hint" id={`${fieldId}-resolution-hint`}>
          Free text, such as 1920x1080.
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
