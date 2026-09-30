/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A partial milestone update: the fields supplied replace the stored field and every other stored field is kept. Unknown fields are rejected. A milestone must reference at least one project through `testSuiteIds` or `testRunIds`: an update that leaves it referencing none is `invalid_request`, and the caller needs the `owner` role in every project the references reach.
 */
export type MilestoneUpdateRequest = {
  /**
   * Optional. A value that restates the addressed identifier or the stored one is accepted; an unusable value is `invalid_id` and a usable value naming another document is `invalid_request`, because an identifier is immutable — rename by deleting and recreating the document.
   */
  milestoneId?: string;
  name?: string;
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

