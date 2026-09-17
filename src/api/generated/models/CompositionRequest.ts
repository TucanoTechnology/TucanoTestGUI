/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Creation-or-placement body shared by the parent-scoped collection routes. A body with `name` (suite) or `title` (case) creates: the new suite is identified as `<name>.json`, the new case by its `testCaseId`, and `expectedResult` is required alongside a case `title`. Otherwise the body names an existing `suiteId`/`testCaseId` to place that child here, with `mode` choosing copy (the default) or move. `mode` alongside the fields that create is a 400, as is a `mode` other than `copy` or `move`. Fields the reading in use does not know are ignored, so the schema does not claim `additionalProperties: false`.
 */
export type CompositionRequest = {
  /**
   * Creation: the suite name; the identifier is always `<name>.json`
   */
  name?: string;
  /**
   * Placement: the existing suite to copy or move here. Ignored when the body creates.
   */
  suiteId?: string;
  /**
   * Creation: the case title
   */
  title?: string;
  /**
   * Creation: the identifier of the new case. Placement: the existing case to copy or move here
   */
  testCaseId?: string;
  /**
   * Creation: the result the case expects; required alongside `title`
   */
  expectedResult?: string;
  /**
   * Placement only: `copy` duplicates the child into this parent and keeps the source in place (the default); `move` relocates it
   */
  mode?: 'copy' | 'move';
};

