/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The execution result of one case in a run, as the client records it. Recording for a case the run already records merges into the stored result: `status` and `timestamp` are replaced, `notes` and `durationMs` are replaced only when the body supplies them, and the stored `attachments` and `defectLinks` are never touched. Omitting `notes` or `durationMs` keeps the stored value, an explicit `null` clears it — the reading an explicit `null` has always had on this route — and an unknown field is rejected rather than ignored. A result may only be recorded for a case the run holds, so a case the run neither declares nor records answers `404`.
 */
export type TestResultRequest = {
  /**
   * The case the result belongs to; it must be one the run holds.
   */
  testCaseId: string;
  status: 'Passed' | 'Failed' | 'Blocked' | 'Untested' | 'Retest';
  /**
   * When the execution happened. Stored verbatim, so any non-empty string is accepted; the current time in Unix seconds, rendered as a string, when the field is omitted or `null`.
   */
  timestamp?: string | null;
  /**
   * The run's notes on the execution; a re-recording that omits the field keeps the stored notes, while `null` clears them.
   */
  notes?: string | null;
  /**
   * How long the case took, in milliseconds; stored with the result and summed by the summary report. A re-recording that omits the field keeps a stored duration and `null` clears it; a result that carries none contributes nothing to `totalDurationMs`.
   */
  durationMs?: number | null;
};

