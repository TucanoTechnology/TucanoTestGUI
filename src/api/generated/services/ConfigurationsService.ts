/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MessageResponse } from '../models/MessageResponse';
import type { TestConfiguration } from '../models/TestConfiguration';
import type { TestConfigurationUpdateRequest } from '../models/TestConfigurationUpdateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ConfigurationsService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Read a configuration
   * @returns TestConfiguration Configuration document
   * @throws ApiError
   */
  public getConfiguration({
    id,
  }: {
    id: string,
  }): CancelablePromise<TestConfiguration> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/configurations/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Update a configuration
   * @returns MessageResponse Updated. `document` carries the configuration as stored.
   * @throws ApiError
   */
  public updateConfiguration({
    id,
    requestBody,
    ifMatch,
  }: {
    id: string,
    requestBody: TestConfigurationUpdateRequest,
    /**
     * Optional optimistic-concurrency precondition: the `ETag` value last read for this document. A `PUT` carrying it is applied only if the stored document still digests to it; otherwise the request is refused `412` — code `conflict` — carrying the CURRENT digest, so the client can re-read in one round trip. Absent or empty, the update follows the legacy last-writer-wins path.
     */
    ifMatch?: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/configurations/{id}',
      path: {
        'id': id,
      },
      headers: {
        'If-Match': ifMatch,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that the store cannot file — not a single path segment, one missing the \`.json\` suffix where the resource requires it, or one longer than the 255 bytes one stored component may hold — or \`invalid_request\` for a rejected body: an unknown or missing field, a field whose type does not match the schema, or, on an update, a body identifier that names another document, which is refused because an identifier is immutable and is renamed by deleting and recreating it; or a \`name\` that would need a stored name longer than 255 bytes, refused here rather than failing as a storage error when it is written.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        412: `The \`If-Match\` digest no longer describes the stored document: it was modified between the read and this update. The response carries the CURRENT digest in \`ETag\` — re-read, re-apply, retry with the new value. The published code is \`conflict\`; the status is \`412\`, distinguishing the precondition failure from a create-time \`409\` clash.`,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Delete a configuration
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteConfiguration({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/configurations/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
}
