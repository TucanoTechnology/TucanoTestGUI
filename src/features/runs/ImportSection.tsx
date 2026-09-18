import { useId, useState, type ChangeEvent } from "react";
import type { ImportSummary } from "../../api/generated/index.js";
import { readApiError, type ApiErrorInfo } from "../../api/errors.js";
import { ApiErrorNotice } from "../../app/ApiErrorNotice.js";
import {
  buildImportRequest,
  ImportFileError,
  type ImportFormat,
  type ImportRequest,
} from "./importResults.js";

export interface ImportSectionProps {
  busy?: boolean;
  /** Posts the picked file's contents and resolves with what the import did. */
  onImport: (request: ImportRequest) => Promise<ImportSummary>;
}

/** The counts a summary carries, in the order the section states them. */
function summaryRows(summary: ImportSummary) {
  return [
    { label: "Imported", value: summary.imported },
    { label: "Skipped", value: summary.skipped },
    { label: "Passed", value: summary.summary.passed },
    { label: "Failed", value: summary.summary.failed },
    { label: "Blocked", value: summary.summary.blocked },
    { label: "Already recorded", value: summary.duplicates },
    { label: "Unusable", value: summary.errors },
  ];
}

/**
 * Importing results into a run: a picker per format the API reads, and the
 * summary of what the last import did. The request and the re-read that follows
 * it belong to the caller; this section owns their progress, the error the API
 * answered with and the summary that came back.
 */
export function ImportSection({ busy = false, onImport }: ImportSectionProps) {
  const fieldId = useId();
  const headingId = `${fieldId}-heading`;
  const hintId = `${fieldId}-hint`;
  const [imported, setImported] = useState<{
    filename: string;
    summary: ImportSummary;
  } | null>(null);
  const [error, setError] = useState<ApiErrorInfo | null>(null);
  const [working, setWorking] = useState(false);

  const locked = busy || working;

  const pick =
    (format: ImportFormat) => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Clearing the picker lets the same file be picked again after a failure.
      event.target.value = "";
      if (!file) return;

      setWorking(true);
      setError(null);
      try {
        const request = buildImportRequest(format, await file.text());
        const summary = await onImport(request);
        // A failed import clears the summary, so the counts on screen are only
        // ever the ones an import that succeeded reported.
        setImported({ filename: file.name, summary });
      } catch (err: unknown) {
        setImported(null);
        setError(
          err instanceof ImportFileError
            ? { code: null, message: err.message }
            : readApiError(err, `Failed to import ${file.name}`),
        );
      } finally {
        setWorking(false);
      }
    };

  return (
    <section
      className="import-section"
      aria-labelledby={headingId}
      aria-busy={locked}
    >
      <h2 id={headingId} className="import-section__title">
        Import results
      </h2>

      <div className="form-field">
        <label htmlFor={`${fieldId}-json`}>Import JSON results</label>
        <input
          id={`${fieldId}-json`}
          type="file"
          accept=".json,application/json"
          aria-describedby={hintId}
          disabled={locked}
          onChange={pick("json")}
        />
      </div>

      <div className="form-field">
        <label htmlFor={`${fieldId}-junit`}>Import JUnit XML results</label>
        <input
          id={`${fieldId}-junit`}
          type="file"
          accept=".xml,application/xml"
          aria-describedby={hintId}
          disabled={locked}
          onChange={pick("junit")}
        />
      </div>

      <p className="import-section__hint" id={hintId}>
        {working
          ? "Importing…"
          : "Each case a report names that this run does not already record is written to it."}
      </p>

      {error && <ApiErrorNotice error={error} />}

      {imported && (
        <>
          <p className="import-summary__source">
            Imported from {imported.filename}
          </p>
          <dl className="import-summary">
            {summaryRows(imported.summary).map((row) => (
              <div key={row.label} className="import-summary__stat">
                <dt className="import-summary__stat-label">{row.label}</dt>
                <dd className="import-summary__stat-value">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
