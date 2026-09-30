/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The replacement for the result the run stores for the case the path names. The shape is the one `POST /test_runs/{id}/results` accepts, with the case already given by the path: `testCaseId` may be omitted, and when the body carries it the value must equal the `case_id` in the path. `status` and `timestamp` replace the stored values; `notes` and `durationMs` replace them only when the body supplies the field, an explicit `null` clearing the stored value; and the stored `attachments` and `defectLinks` are never touched, because the body cannot describe them. An unknown field is rejected rather than ignored, and a run that stores no result for the case answers `404` rather than creating one.
 */
export type TestResultReplaceRequest = {
  /**
   * The case the replacement belongs to. Optional here: the path already names the case, and a value that differs from it is rejected.
   */
  testCaseId?: string;
  status: 'Passed' | 'Failed' | 'Blocked' | 'Untested' | 'Retest';
  /**
   * When the execution happened. Stored verbatim, so any non-empty string is accepted; the current time in Unix seconds, rendered as a string, when the field is omitted or `null`.
   */
  timestamp?: string | null;
  /**
   * The run's notes on the execution; a replacement that omits the field keeps the stored notes, while `null` clears them.
   */
  notes?: string | null;
  /**
   * How long the case took, in milliseconds; stored with the result and summed by the summary report. A replacement that omits the field keeps a stored duration and `null` clears it; a result that carries none contributes nothing to `totalDurationMs`.
   */
  durationMs?: number | null;
};

