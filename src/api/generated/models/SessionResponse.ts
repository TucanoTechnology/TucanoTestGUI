/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The session a sign-in or refresh answers with: a short-lived access token, a single-use refresh token, and how long each outlives the answer.
 */
export type SessionResponse = {
  /**
   * The signed token to send as `Authorization: Bearer <token>`.
   */
  accessToken: string;
  /**
   * The refresh token that replaces the one just used, or the one this sign-in issued.
   */
  refreshToken: string;
  /**
   * Always `Bearer`.
   */
  tokenType: string;
  /**
   * Seconds until `accessToken` expires.
   */
  expiresIn: number;
};

