/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * How the results in scope split by status, with their pass rate and total duration. `total` counts every recorded result, so it exceeds the four named buckets when a run records `Retest` or an unrecognised status: those count toward `passPercentage`'s denominator without being a pass or a failure. `totalDurationMs` sums the `durationMs` of the results that carry one and treats a result without one as zero.
 */
export type SummaryReport = {
  /**
   * Every result in scope, including `Retest` and unrecognised statuses
   */
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  untested: number;
  /**
   * `passed` as a percentage of `total`, or `0` when there is no result
   */
  passPercentage: number;
  /**
   * The summed `durationMs` of the results in scope
   */
  totalDurationMs: number;
};

