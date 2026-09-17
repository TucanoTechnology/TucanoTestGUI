/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The execution result recorded for one case in a run. Unknown fields are ignored, and a `timestamp` supplied by the client is stored verbatim.
 */
export type TestResultRequest = {
  testCaseId: string;
  status: 'Passed' | 'Failed' | 'Blocked' | 'Untested' | 'Retest';
  /**
   * Defaults to the current time in Unix seconds, rendered as a string
   */
  timestamp?: string;
  notes?: string;
  /**
   * How long the case took, in milliseconds; stored with the result and summed by the summary report. Omitted, the result contributes nothing to `totalDurationMs`.
   */
  durationMs?: number;
};

