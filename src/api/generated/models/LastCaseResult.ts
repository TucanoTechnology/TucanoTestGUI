/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The latest result one case holds among the runs in scope. `runId` is the listing key of the run that recorded it — the address `GET /test_runs/{id}` takes — and `status` and `timestamp` are that result's stored values verbatim.
 */
export type LastCaseResult = {
  /**
   * The case's identity, as the result stored it
   */
  testCaseId: string;
  /**
   * The recorded status, verbatim: the report does not reject a value outside the five the record route writes
   */
  status: string;
  /**
   * The listing key of the run that recorded it
   */
  runId: string;
  /**
   * The winning result's stored timestamp string
   */
  timestamp: string;
};

