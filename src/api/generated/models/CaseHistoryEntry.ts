/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * One recorded revision of a case. `changedFields` lists the qualifying fields — `title`, `steps`, `preconditions`, `expectedResult` — in which the snapshot differs from the version that superseded it, so the newest snapshot's entry compares against the live document. `lastModified` is the snapshot's own stamp, absent for a snapshot written before versioning, which is why it is not required.
 */
export type CaseHistoryEntry = {
  version: number;
  lastModified?: string;
  changedFields: Array<string>;
};

