/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Error = {
  error?: {
    code: 'invalid_id' | 'invalid_request' | 'invalid_status' | 'invalid_multipart' | 'missing_file' | 'not_found' | 'conflict' | 'storage_error' | 'missing_token' | 'invalid_token' | 'token_expired' | 'invalid_credentials' | 'invalid_refresh_token' | 'forbidden' | 'not_ready';
    message: string;
    /**
     * The request id, also returned in the `X-Request-Id` response header.
     */
    requestId?: string;
  };
};

