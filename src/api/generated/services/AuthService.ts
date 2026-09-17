/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { LoginRequest } from '../models/LoginRequest';
import type { LogoutRequest } from '../models/LogoutRequest';
import type { MeResponse } from '../models/MeResponse';
import type { MessageResponse } from '../models/MessageResponse';
import type { RefreshRequest } from '../models/RefreshRequest';
import type { SessionResponse } from '../models/SessionResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuthService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Sign in
   * Exchange a username and password for a session. The access token the answer carries is the caller's authority for every other operation; the refresh token is single-use and is rotated by `/auth/refresh`. This operation and `/auth/refresh` are the only two that need no caller, because they are how a caller comes to have one.
   * @returns SessionResponse Session
   * @throws ApiError
   */
  public login({
    requestBody,
  }: {
    requestBody: LoginRequest,
  }): CancelablePromise<SessionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/auth/login',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`invalid_credentials\`: the username is unknown or the password does not match. The two are not distinguished. The response carries the \`WWW-Authenticate\` challenge.`,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Exchange a refresh token
   * Rotate a refresh token into a new session. The token presented is revoked as it is exchanged, so a replayed token is rejected rather than answered; a client that loses the rotation race signs in again.
   * @returns SessionResponse Session
   * @throws ApiError
   */
  public refreshSession({
    requestBody,
  }: {
    requestBody: RefreshRequest,
  }): CancelablePromise<SessionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/auth/refresh',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`invalid_refresh_token\`: the refresh token is unknown, expired, revoked or already exchanged. The response carries the \`WWW-Authenticate\` challenge.`,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Sign out
   * Revoke a refresh token. The access token that authorised the call stays valid until it expires, so a client that signs out should discard it; the refresh token cannot be exchanged afterwards.
   * @returns MessageResponse Signed out
   * @throws ApiError
   */
  public logout({
    requestBody,
  }: {
    requestBody: LogoutRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/auth/logout',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Who the caller is
   * The account the access token names, the authority the deployment reports for it, and the role it holds on each project. The authority is the token's and is not re-read from the account file.
   * @returns MeResponse Account
   * @throws ApiError
   */
  public getCurrentUser(): CancelablePromise<MeResponse> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/auth/me',
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
      },
    });
  }
}
