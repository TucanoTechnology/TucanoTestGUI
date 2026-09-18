import type {
  TestCaseResult,
  TestResultRequest,
  TestRun,
} from "../../api/generated/index.js";

/** The statuses the API accepts, in the order the result form offers them. */
export const RESULT_STATUSES = [
  "Passed",
  "Failed",
  "Blocked",
  "Untested",
  "Retest",
] as const;

export type ResultStatus = (typeof RESULT_STATUSES)[number];

/** One row of the results table: a case the run holds and what it records. */
export interface ResultRow {
  testCaseId: string;
  /** The title the run's case snapshot carries; absent for a case it lacks. */
  title?: string;
  /**
   * The recorded status, or `Untested` when the run holds no result for the
   * case yet. Read from the document, so it stays a string: storage a
   * hand-edit reaches is not the API's ordinary output.
   */
  status: string;
  /** The result the run records for this case, absent when it records none. */
  result?: TestCaseResult;
}

/**
 * Pairs the run's case snapshot with the results it records, in snapshot order.
 *
 * A result whose case the snapshot does not hold still gets a row: the API
 * accepts one (`TucanoTestAPI#285`), and hiding it would leave the table
 * shorter than the count printed above it.
 */
export function buildResultRows(run: TestRun): ResultRow[] {
  const results = run.results ?? [];
  const byCase = new Map(results.map((result) => [result.testCaseId, result]));
  const rows: ResultRow[] = (run.testCases ?? []).map((testCase) => {
    const result = byCase.get(testCase.testCaseId);
    if (result) byCase.delete(testCase.testCaseId);
    return {
      testCaseId: testCase.testCaseId,
      title: testCase.title,
      status: result?.status ?? "Untested",
      result,
    };
  });

  for (const result of results) {
    if (!byCase.has(result.testCaseId)) continue;
    byCase.delete(result.testCaseId);
    rows.push({
      testCaseId: result.testCaseId,
      status: result.status,
      result,
    });
  }

  return rows;
}

/** A duration as the table reads it back. An absent duration reads `—`. */
export function formatDuration(durationMs?: number): string {
  if (durationMs === undefined) return "—";
  if (durationMs < 1000) return `${durationMs} ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${formatSeconds(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} m ${formatSeconds(seconds - minutes * 60)} s`;
}

/** The same duration as the form's seconds field reads it back. */
export function formatDurationSeconds(durationMs?: number): string {
  if (durationMs === undefined) return "";
  return formatSeconds(durationMs / 1000);
}

function formatSeconds(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

/**
 * Reads the form's seconds field. An empty field leaves the duration out of
 * the request, which is how the API clears one: it stores no fraction and
 * drops anything that is not a non-negative whole number of milliseconds.
 */
export function parseDurationSeconds(value: string): {
  durationMs?: number;
  error: string | null;
} {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { durationMs: undefined, error: null };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { error: "Enter the duration in seconds, or leave it blank." };
  }
  const durationMs = Math.round(Number(trimmed) * 1000);
  if (!Number.isSafeInteger(durationMs)) {
    return { error: "That duration is too long to store." };
  }
  return { durationMs, error: null };
}

/** What the result form hands over once it has validated it. */
export interface ResultSubmission {
  status: ResultStatus;
  notes: string;
  /** Absent leaves the field out of the request, which clears the duration. */
  durationMs?: number;
}

/**
 * Builds the record request. The API replaces the whole result rather than
 * merging into it, so every field the record should keep has to be resent: an
 * empty comment or duration is left out on purpose, which clears it, and the
 * stored timestamp travels back with an edit so re-recording a result cannot
 * quietly re-date it.
 */
export function buildResultRequest(
  testCaseId: string,
  values: ResultSubmission,
  existing?: TestCaseResult,
): TestResultRequest {
  const request: TestResultRequest = { testCaseId, status: values.status };
  const notes = values.notes.trim();
  if (notes.length > 0) request.notes = notes;
  if (values.durationMs !== undefined) request.durationMs = values.durationMs;
  if (existing && existing.timestamp.length > 0) {
    request.timestamp = existing.timestamp;
  }
  return request;
}

/**
 * Why a recorded result cannot be recorded again, or `null` when it can.
 *
 * The record route replaces the whole result, and `TestResultRequest` cannot
 * express a defect link or an attachment, so re-recording a result that holds
 * either drops it (`TucanoTestAPI#284`). The two counts are the only fields on
 * a result the request cannot carry.
 */
export function rerecordBlocker(result: TestCaseResult | undefined): string | null {
  const linked = result?.defectLinks?.length ?? 0;
  const attachments = result?.attachments?.length ?? 0;
  if (linked === 0 && attachments === 0) return null;

  const holds: string[] = [];
  if (linked > 0) holds.push(`${linked} linked defect${linked === 1 ? "" : "s"}`);
  if (attachments > 0) {
    holds.push(`${attachments} attachment${attachments === 1 ? "" : "s"}`);
  }

  return `This result holds ${holds.join(" and ")}. Recording it again would discard them, because the API replaces the whole result and its request cannot carry them (see TucanoTestAPI#284). Unlink them first if the record itself must change.`;
}
