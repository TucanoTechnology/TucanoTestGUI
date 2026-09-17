/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SuiteCoverage } from './SuiteCoverage';
/**
 * How many cases the tree holds, per suite and in total. `projectId` is echoed back only when the report was scoped to one project, so a global report omits it. Cases held directly by a project are counted in `totalCases` but appear in no suite entry, so `totalCases` can exceed the sum of the `caseCount` values.
 */
export type CoverageReport = {
  /**
   * The project the report was scoped to; absent for a report across every project
   */
  projectId?: string;
  /**
   * Every case in scope, including those held directly by a project
   */
  totalCases: number;
  suites: Array<SuiteCoverage>;
};

