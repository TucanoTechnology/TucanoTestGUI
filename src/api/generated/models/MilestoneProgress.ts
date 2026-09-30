/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Derived progress over the runs a milestone links. `totalCases` is the size of the population, counting each case once: a run holds the cases its `testCases` snapshot declares, the cases its embedded `testSuites` declare, and the cases it has a recorded result for, and the population is their union across the linked runs. The five buckets partition that population, so `passed + failed + blocked + untested + retest` always equals `totalCases`, and a held case with no result — like one stored under an unrecognised status — is `untested`. `passPercentage` is `passed / totalCases * 100` unrounded, and is `0` when `totalCases` is `0`.
 */
export type MilestoneProgress = {
  milestoneId: string;
  totalCases: number;
  passed: number;
  failed: number;
  blocked: number;
  untested: number;
  retest: number;
  passPercentage: number;
};

