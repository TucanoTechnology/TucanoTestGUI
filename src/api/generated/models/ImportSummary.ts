/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ImportCounts } from './ImportCounts';
/**
 * What one JUnit import did. `skipped` is the cases deliberately left unwritten: the `duplicates` the run already recorded plus the `errors` it could not map, so `imported + skipped` is every `<testcase>` the report held.
 */
export type ImportSummary = {
  /**
   * Results written by this import
   */
  imported: number;
  /**
   * Cases not written: `duplicates + errors`
   */
  skipped: number;
  /**
   * Cases that could not be named and were not written
   */
  errors: number;
  /**
   * Cases the run already recorded, left untouched
   */
  duplicates: number;
  summary: ImportCounts;
};

