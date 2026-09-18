import type { ImportEntry, ImportSummary } from "../../api/generated/index.js";

/** The two report formats the API reads a run's results from. */
export type ImportFormat = "json" | "junit";

/**
 * The picked file could not be read as the format it was picked as. A file that
 * parses but that the API will not accept is the API's answer to give.
 */
export class ImportFileError extends Error {}

/** The body one import posts, keyed by the format the file was picked as. */
export type ImportRequest =
  | { format: "json"; body: ImportEntry[] | { results: ImportEntry[] } }
  | { format: "junit"; body: string };

/**
 * Turn a picked file's text into the body its route takes. JSON is parsed here
 * so a malformed file is refused without a request; the shape of what parses is
 * the API's to judge, so the document is posted as it stands. JUnit XML travels
 * verbatim, since the report is the body.
 */
export function buildImportRequest(
  format: ImportFormat,
  text: string,
): ImportRequest {
  if (format === "junit") {
    return { format: "junit", body: text };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ImportFileError("The file is not valid JSON.");
  }

  return { format: "json", body: parsed as ImportEntry[] | { results: ImportEntry[] } };
}

/** What an import did, in one sentence for the live region. */
export function describeImportSummary(summary: ImportSummary): string {
  const { passed, failed, blocked } = summary.summary;
  const imported = `Imported ${summary.imported} ${summary.imported === 1 ? "result" : "results"}: ${passed} passed, ${failed} failed, ${blocked} blocked.`;

  if (summary.skipped === 0) return imported;

  return `${imported} Skipped ${summary.skipped}: ${summary.duplicates} already recorded, ${summary.errors} unusable.`;
}
