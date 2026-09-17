/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A milestone to create. `name` is required. Unknown fields are rejected. A milestone must reference at least one project through `testSuiteIds` or `testRunIds`: one that references none is `invalid_request`, and the caller needs the `owner` role in every project the references reach.
 */
export type MilestoneCreateRequest = {
  /**
   * Optional identifier; defaults to `name`, stored as `<milestoneId>.json` when it does not already end in `.json`.
   */
  milestoneId?: string;
  name: string;
  description?: string;
  startDate?: string;
  targetDate?: string;
  status?: string;
  testSuiteIds?: Array<string>;
  testRunIds?: Array<string>;
};

