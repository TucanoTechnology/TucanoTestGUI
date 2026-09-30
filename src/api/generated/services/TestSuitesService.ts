/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AttachmentUpload } from '../models/AttachmentUpload';
import type { CompositionRequest } from '../models/CompositionRequest';
import type { CompositionResponse } from '../models/CompositionResponse';
import type { CreateResponse } from '../models/CreateResponse';
import type { DuplicateRequest } from '../models/DuplicateRequest';
import type { MessageResponse } from '../models/MessageResponse';
import type { StepAttachment } from '../models/StepAttachment';
import type { TestSuite } from '../models/TestSuite';
import type { TestSuiteUpdateRequest } from '../models/TestSuiteUpdateRequest';
import type { UploadResponse } from '../models/UploadResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TestSuitesService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Read a test suite with the cases it holds assembled
   * @returns TestSuite Test suite document
   * @throws ApiError
   */
  public getTestSuite({
    id,
    children,
  }: {
    id: string,
    /**
     * Optional: `ids` answers this read’s `testSuites` and `testCases` arrays with the children’s wire identifiers instead of embedded documents (#415) — the shape a context tree fetches, priced at one folder walk. An unknown value, or the parameter absent, keeps the embedded documents; the parameter is ignored by every resource that does not hydrate children.
     */
    children?: 'ids',
  }): CancelablePromise<TestSuite> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}',
      path: {
        'id': id,
      },
      query: {
        'children': children,
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
   * Update a test suite
   * @returns MessageResponse Updated
   * @throws ApiError
   */
  public updateTestSuite({
    id,
    requestBody,
    ifMatch,
  }: {
    id: string,
    requestBody: TestSuiteUpdateRequest,
    /**
     * Optional optimistic-concurrency precondition: the `ETag` value last read for this document. A `PUT` carrying it is applied only if the stored document still digests to it; otherwise the request is refused `412` — code `conflict` — carrying the CURRENT digest, so the client can re-read in one round trip. Absent or empty, the update follows the legacy last-writer-wins path.
     */
    ifMatch?: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/test_suites/{id}',
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
   * Delete a test suite and the cases it holds
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestSuite({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}',
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
   * Duplicate test suite
   * An unusable identifier answers `invalid_id`, whether it arrives in the path or as a body `newId`, as it does on the run and milestone duplicate routes; `POST /projects/{id}/duplicate` answers `invalid_request` for an unusable path identifier, and the case route answers `404` because a case identifier is addressed verbatim. Unknown fields in the body are ignored.
   * @returns CreateResponse Duplicated
   * @throws ApiError
   */
  public duplicateTestSuite({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: DuplicateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/duplicate',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the test cases a suite holds
   * @returns string Test case IDs
   * @throws ApiError
   */
  public listTestSuiteCases({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}/test_cases',
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
   * Create a test case in a suite, or place an existing one
   * A body carrying a `title` creates a case in the suite and must also carry the `testCaseId` and `expectedResult` a case needs. Otherwise the body names an existing `testCaseId` to place here, and `mode` chooses copy (the default) or move.
   * @returns CompositionResponse Created, copied, or moved
   * @throws ApiError
   */
  public addTestSuiteCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: CompositionRequest,
  }): CancelablePromise<CompositionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/test_cases',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that the store cannot file — not a single path segment, one missing the \`.json\` suffix where the resource requires it, or one longer than the 255 bytes one stored component may hold — or \`invalid_request\` for a rejected body: an unknown or missing field, a field whose type does not match the schema, or, on an update, a body identifier that names another document, which is refused because an identifier is immutable and is renamed by deleting and recreating it; or a \`name\` that would need a stored name longer than 255 bytes, refused here rather than failing as a storage error when it is written.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Remove a test case from a suite
   * @returns MessageResponse Removed
   * @throws ApiError
   */
  public removeTestSuiteCase({
    id,
    caseId,
  }: {
    id: string,
    caseId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}/test_cases/{case_id}',
      path: {
        'id': id,
        'case_id': caseId,
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
   * Upload attachment to a suite test case
   * Uploads to the case the named suite holds, which is how an identifier two parents share is addressed. The first multipart part is the attachment; its part name is not inspected, but it must carry a filename.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadTestSuiteTestCaseAttachment({
    id,
    caseId,
    formData,
  }: {
    id: string,
    caseId: string,
    formData: AttachmentUpload,
  }): CancelablePromise<UploadResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/test_cases/{case_id}/attachments',
      path: {
        'id': id,
        'case_id': caseId,
      },
      formData: formData,
      mediaType: 'multipart/form-data',
      errors: {
        400: `The parent-scoped case-attachment upload's 400s. \`invalid_id\` when the parent's identifier is not a single path component ending in \`.json\`, or the case identifier it names is not a single path component: a case reached through a parent is resolved from the path, so an unusable identifier is rejected here rather than answered \`404\` as it is on the bare route. Otherwise the upload route's own: \`invalid_request\` when the name the file would be stored under, \`<suffix>-<original name>\`, would exceed the 255 bytes one stored component may hold, \`invalid_multipart\` when the multipart body cannot be parsed and \`missing_file\` when no part carries a filename, both as the error envelope; but the multipart extractor rejects a request that is not valid \`multipart/form-data\` before the handler runs, and that answer is plain text — \`Invalid \\\`boundary\\\` for \\\`multipart/form-data\\\` request\` — not the envelope.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Download a suite test case attachment
   * Serves the file stored on the case the named suite holds, which is how an identifier two parents share is addressed. An unattached filename answers `404`. The body is always `application/octet-stream` — the media type recorded in the document is metadata and never replays onto the wire — so a client that decodes by response content type still receives bytes.
   * @returns binary File content, served as `application/octet-stream` and named by `Content-Disposition`
   * @throws ApiError
   */
  public downloadTestSuiteTestCaseAttachment({
    id,
    caseId,
    filename,
  }: {
    id: string,
    caseId: string,
    /**
     * Name of a stored attachment file, `<suffix>-<original name>` — the `filename` the upload route answers and the `Attachment` metadata carries, not the `originalName` the client sent. A value that addresses no stored file is reported as `not_found`: a name that is absent, that is not a single plain path component (`.` and `..` among them), or that names a directory.
     */
    filename: string,
  }): CancelablePromise<Blob> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}/test_cases/{case_id}/attachments/{filename}',
      path: {
        'id': id,
        'case_id': caseId,
        'filename': filename,
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
   * Delete a suite test case attachment
   * Removes the file and its metadata from the case the named suite holds, which is how an identifier two parents share is addressed. An unattached filename answers `404`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestSuiteTestCaseAttachment({
    id,
    caseId,
    filename,
  }: {
    id: string,
    caseId: string,
    /**
     * Name of a stored attachment file, `<suffix>-<original name>` — the `filename` the upload route answers and the `Attachment` metadata carries, not the `originalName` the client sent. A value that addresses no stored file is reported as `not_found`: a name that is absent, that is not a single plain path component (`.` and `..` among them), or that names a directory.
     */
    filename: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}/test_cases/{case_id}/attachments/{filename}',
      path: {
        'id': id,
        'case_id': caseId,
        'filename': filename,
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
   * List a suite test case's step attachments
   * Returns the metadata recorded for the addressed structured step of the case the named suite holds, an empty array when it carries none. The index walks the case's `steps` array, where a plain string step has no attachments.
   * @returns StepAttachment Step attachment metadata
   * @throws ApiError
   */
  public listTestSuiteTestCaseStepAttachments({
    id,
    caseId,
    stepIndex,
  }: {
    id: string,
    caseId: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
  }): CancelablePromise<Array<StepAttachment>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_suites/{id}/test_cases/{case_id}/steps/{step_index}/attachments',
      path: {
        'id': id,
        'case_id': caseId,
        'step_index': stepIndex,
      },
      errors: {
        400: `\`invalid_id\` when the parent's identifier is not a single path component ending in \`.json\`, or the case identifier it names is not a single path component: a case reached through a parent is resolved from the path, so an unusable identifier is rejected here rather than answered \`404\` as it is on the bare route. Otherwise \`invalid_request\`: the step index is not a non-negative integer, is beyond the end of the case's \`steps\` array, or names a plain string step rather than a structured one.`,
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
   * Upload a suite test case step attachment
   * Uploads to the addressed structured step of the case the named suite holds, which is how an identifier two parents share is addressed. The first multipart part is the attachment; its part name is not inspected, but it must carry a filename.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadTestSuiteTestCaseStepAttachment({
    id,
    caseId,
    stepIndex,
    formData,
  }: {
    id: string,
    caseId: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
    formData: AttachmentUpload,
  }): CancelablePromise<UploadResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_suites/{id}/test_cases/{case_id}/steps/{step_index}/attachments',
      path: {
        'id': id,
        'case_id': caseId,
        'step_index': stepIndex,
      },
      formData: formData,
      mediaType: 'multipart/form-data',
      errors: {
        400: `The parent-scoped step-attachment upload's 400s. \`invalid_id\` when the parent's identifier is not a single path component ending in \`.json\`, or the case identifier it names is not a single path component; \`invalid_request\` when the step index is not a non-negative integer, is beyond the end of the case's \`steps\` array or names a plain string step, or when the name the file would be stored under, \`<suffix>-<original name>\`, would exceed the 255 bytes one stored component may hold; \`invalid_multipart\` when the multipart body cannot be parsed and \`missing_file\` when no part carries a filename, all as the error envelope; but the multipart extractor rejects a request that is not valid \`multipart/form-data\` before the handler runs, and that answer is plain text.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Delete a suite test case step attachment
   * Removes the file and its metadata from the addressed step of the case the named suite holds. An unattached filename answers `404`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestSuiteTestCaseStepAttachment({
    id,
    caseId,
    stepIndex,
    filename,
  }: {
    id: string,
    caseId: string,
    /**
     * A value that is not a non-negative integer is reported as `invalid_request`.
     */
    stepIndex: number,
    /**
     * Name of a stored attachment file, `<suffix>-<original name>` — the `filename` the upload route answers and the `Attachment` metadata carries, not the `originalName` the client sent. A value that addresses no stored file is reported as `not_found`: a name that is absent, that is not a single plain path component (`.` and `..` among them), or that names a directory.
     */
    filename: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_suites/{id}/test_cases/{case_id}/steps/{step_index}/attachments/{filename}',
      path: {
        'id': id,
        'case_id': caseId,
        'step_index': stepIndex,
        'filename': filename,
      },
      errors: {
        400: `\`invalid_id\` when the parent's identifier is not a single path component ending in \`.json\`, or the case identifier it names is not a single path component: a case reached through a parent is resolved from the path, so an unusable identifier is rejected here rather than answered \`404\` as it is on the bare route. Otherwise \`invalid_request\`: the step index is not a non-negative integer, is beyond the end of the case's \`steps\` array, or names a plain string step rather than a structured one.`,
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
