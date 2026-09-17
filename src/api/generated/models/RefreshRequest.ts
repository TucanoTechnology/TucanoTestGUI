/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The refresh token to rotate. Rotation revokes the token presented, so a token can be exchanged at most once.
 */
export type RefreshRequest = {
  /**
   * The refresh token issued by the last sign-in or refresh.
   */
  refreshToken: string;
};

