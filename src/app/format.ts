/**
 * Display formatting for the timestamps the API stores.
 *
 * The run's `timestamp` is written as epoch seconds (`1757800000`), while a
 * case's `lastModified` arrives as an ISO 8601 string, so one helper has to
 * read both shapes. A value neither explains — a hand-edited document, say —
 * is returned untouched rather than rendered as `Invalid Date`.
 */
export function formatTimestamp(value: string | number | undefined): string {
  if (value === undefined || value === null) return "—";
  const text = String(value).trim();
  if (text.length === 0) return "—";

  let date: Date | null = null;
  if (/^\d{10}(\.\d+)?$/.test(text)) {
    date = new Date(Number(text) * 1000);
  } else if (/^\d{13}$/.test(text)) {
    date = new Date(Number(text));
  } else if (!Number.isNaN(Date.parse(text))) {
    date = new Date(text);
  }
  if (!date || Number.isNaN(date.getTime())) return text;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
