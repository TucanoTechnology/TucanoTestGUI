/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DuplicateCaseRequest = {
  /**
   * Identifier for the copy; derived from the source when omitted. A supplied value must be a single path segment; an unusable one is `invalid_id`.
   */
  newId?: string;
  /**
   * Title for the copy; the source title is kept when omitted
   */
  newTitle?: string;
};

