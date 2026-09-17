/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The readiness answer, returned only when every check passed. A store that failed a check answers `503` with the error envelope instead of this body.
 */
export type ReadyResponse = {
  /**
   * Always `ready`: the states that are not ready are never reported through this field.
   */
  status: 'ready';
  /**
   * Which backend the process was started with. Documents are stored on the filesystem and there is no other backend yet.
   */
  storage: 'filesystem';
};

