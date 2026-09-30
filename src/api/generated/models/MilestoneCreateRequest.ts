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
  /**
   * A document may list at most 512 of these references; a longer array is refused with `400 invalid_request`.
   */
  testSuiteIds?: Array<string>;
  /**
   * A document may list at most 512 of these references; a longer array is refused with `400 invalid_request`.
   */
  testRunIds?: Array<string>;
};

