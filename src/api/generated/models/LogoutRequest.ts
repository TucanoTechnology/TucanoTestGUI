/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The refresh token to revoke alongside the access token that authorised the call. Revoking a token that is unknown or already revoked is not an error.
 */
export type LogoutRequest = {
  /**
   * The refresh token to revoke.
   */
  refreshToken: string;
};

