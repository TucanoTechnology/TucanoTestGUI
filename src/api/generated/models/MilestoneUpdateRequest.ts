/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A partial milestone update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected. A milestone must reference at least one project through `testSuiteIds` or `testRunIds`: an update that leaves it referencing none is `invalid_request`, and the caller needs the `owner` role in every project the references reach.
 */
export type MilestoneUpdateRequest = {
  milestoneId?: string;
  name?: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  status?: string;
  testSuiteIds?: Array<string>;
  testRunIds?: Array<string>;
};

