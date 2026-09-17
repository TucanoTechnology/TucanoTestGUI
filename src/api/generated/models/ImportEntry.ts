/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * One result of a JSON import. Only `Passed`, `Failed` and `Blocked` are accepted — the three outcomes a runner reports — so `Untested` and `Retest` are rejected as `invalid_status`.
 */
export type ImportEntry = {
  /**
   * The case the result belongs to; required and must not be empty.
   */
  testCaseId: string;
  status: 'Passed' | 'Failed' | 'Blocked';
  notes?: string;
  /**
   * Stored verbatim; the current time in Unix seconds when omitted.
   */
  timestamp?: string;
};

