/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Milestone = {
  milestoneId: string;
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

