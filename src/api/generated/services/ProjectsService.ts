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
import type { MilestoneCreateRequest } from '../models/MilestoneCreateRequest';
import type { Project } from '../models/Project';
import type { ProjectCreateRequest } from '../models/ProjectCreateRequest';
import type { ProjectUpdateRequest } from '../models/ProjectUpdateRequest';
import type { StepAttachment } from '../models/StepAttachment';
import type { TestConfigurationCreateRequest } from '../models/TestConfigurationCreateRequest';
import type { TestRunCreateRequest } from '../models/TestRunCreateRequest';
import type { UploadResponse } from '../models/UploadResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ProjectsService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * List projects
   * @returns string Project IDs
   * @throws ApiError
   */
  public listProjects({
    filter,
    tags,
  }: {
    /**
     * Case-insensitive substring filter for resource IDs
     */
    filter?: string,
    /**
     * Comma-separated tags; a resource matches when it carries at least one of them (case-insensitive). Resources without a tags array never match.
     */
    tags?: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects',
      query: {
        'filter': filter,
        'tags': tags,
      },
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a project
   * Create a project. Only a system administrator may create one, because a project that does not exist yet cannot name a grant to hold: every other authenticated caller is answered `forbidden` when authentication is enforced, and the new project starts with no grants.
   * @returns CreateResponse Created
   * @throws ApiError
   */
  public createProject({
    requestBody,
  }: {
    requestBody: ProjectCreateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, a field whose type does not match the schema, a \`projectId\` on \`POST /projects\` that is not a single path segment ending in \`.json\`, or a name-only payload that omits what creation needs; or a \`name\` that would need more than the 255 bytes one stored name may hold, refused here rather than failing as a storage error when the project is written.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Read a project, assembling the suites and directly owned cases it holds
   * @returns Project Project document
   * @throws ApiError
   */
  public getProject({
    id,
    children,
  }: {
    id: string,
    /**
     * Optional: `ids` answers this read’s `testSuites` and `testCases` arrays with the children’s wire identifiers instead of embedded documents (#415) — the shape a context tree fetches, priced at one folder walk. An unknown value, or the parameter absent, keeps the embedded documents; the parameter is ignored by every resource that does not hydrate children.
     */
    children?: 'ids',
  }): CancelablePromise<Project> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}',
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Update a project
   * @returns MessageResponse Updated
   * @throws ApiError
   */
  public updateProject({
    id,
    requestBody,
    ifMatch,
  }: {
    id: string,
    requestBody: ProjectUpdateRequest,
    /**
     * Optional optimistic-concurrency precondition: the `ETag` value last read for this document. A `PUT` carrying it is applied only if the stored document still digests to it; otherwise the request is refused `412` — code `conflict` — carrying the CURRENT digest, so the client can re-read in one round trip. Absent or empty, the update follows the legacy last-writer-wins path.
     */
    ifMatch?: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/projects/{id}',
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
        412: `The \`If-Match\` digest no longer describes the stored document: it was modified between the read and this update. The response carries the CURRENT digest in \`ETag\` — re-read, re-apply, retry with the new value. The published code is \`conflict\`; the status is \`412\`, distinguishing the precondition failure from a create-time \`409\` clash.`,
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Delete a project and everything below it
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteProject({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Duplicate resource
   * An unusable path identifier answers `invalid_request` here, where `POST /test_suites/{id}/duplicate` answers `invalid_id` for either identifier; a body `newId` the store cannot file is `invalid_id` on every duplicate route. Unknown fields in the body are ignored.
   * @returns CreateResponse Duplicated
   * @throws ApiError
   */
  public duplicateProject({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: DuplicateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/duplicate',
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
   * List the test suites a project owns
   * @returns string Test suite IDs
   * @throws ApiError
   */
  public listProjectTestSuites({
    id,
    filter,
    tags,
  }: {
    id: string,
    /**
     * Case-insensitive substring filter for resource IDs
     */
    filter?: string,
    /**
     * Comma-separated tags; a resource matches when it carries at least one of them (case-insensitive). Resources without a tags array never match.
     */
    tags?: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_suites',
      path: {
        'id': id,
      },
      query: {
        'filter': filter,
        'tags': tags,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a test suite in a project, or place an existing one
   * A body with a non-empty `name` creates a suite, identified as `<name>.json`. Otherwise the body names an existing `suiteId` to place here, and `mode` chooses copy (the default) or move.
   * @returns CompositionResponse Created, copied, or moved
   * @throws ApiError
   */
  public addProjectTestSuite({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: CompositionRequest,
  }): CancelablePromise<CompositionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/test_suites',
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
   * Delete a test suite a project owns
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public removeProjectTestSuite({
    id,
    suiteId,
  }: {
    id: string,
    suiteId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}/test_suites/{suite_id}',
      path: {
        'id': id,
        'suite_id': suiteId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the test cases a project directly owns
   * @returns string Test case IDs
   * @throws ApiError
   */
  public listProjectTestCases({
    id,
    filter,
    tags,
  }: {
    id: string,
    /**
     * Case-insensitive substring filter for resource IDs
     */
    filter?: string,
    /**
     * Comma-separated tags; a resource matches when it carries at least one of them (case-insensitive). Resources without a tags array never match.
     */
    tags?: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_cases',
      path: {
        'id': id,
      },
      query: {
        'filter': filter,
        'tags': tags,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a test case in a project, or place an existing one
   * A body carrying a `title` creates a case and must also carry the `testCaseId` and `expectedResult` a case needs. Otherwise the body names an existing `testCaseId` to place here, and `mode` chooses copy (the default) or move.
   * @returns CompositionResponse Created, copied, or moved
   * @throws ApiError
   */
  public addProjectTestCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: CompositionRequest,
  }): CancelablePromise<CompositionResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/test_cases',
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
   * Delete a test case a project owns
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public removeProjectTestCase({
    id,
    caseId,
  }: {
    id: string,
    caseId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}/test_cases/{case_id}',
      path: {
        'id': id,
        'case_id': caseId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Upload attachment to a project test case
   * Uploads to the case the named project holds, which is how an identifier two parents share is addressed. The first multipart part is the attachment; its part name is not inspected, but it must carry a filename.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadProjectTestCaseAttachment({
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
      url: '/projects/{id}/test_cases/{case_id}/attachments',
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
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Download a project test case attachment
   * Serves the file stored on the case the named project holds, which is how an identifier two parents share is addressed. An unattached filename answers `404`. The body is always `application/octet-stream` — the media type recorded in the document is metadata and never replays onto the wire — so a client that decodes by response content type still receives bytes.
   * @returns binary File content, served as `application/octet-stream` and named by `Content-Disposition`
   * @throws ApiError
   */
  public downloadProjectTestCaseAttachment({
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
      url: '/projects/{id}/test_cases/{case_id}/attachments/{filename}',
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Delete a project test case attachment
   * Removes the file and its metadata from the case the named project holds, which is how an identifier two parents share is addressed. An unattached filename answers `404`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteProjectTestCaseAttachment({
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
      url: '/projects/{id}/test_cases/{case_id}/attachments/{filename}',
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List a project test case's step attachments
   * Returns the metadata recorded for the addressed structured step of the case the named project holds, an empty array when it carries none. The index walks the case's `steps` array, where a plain string step has no attachments.
   * @returns StepAttachment Step attachment metadata
   * @throws ApiError
   */
  public listProjectTestCaseStepAttachments({
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
      url: '/projects/{id}/test_cases/{case_id}/steps/{step_index}/attachments',
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Upload a project test case step attachment
   * Uploads to the addressed structured step of the case the named project holds, which is how an identifier two parents share is addressed. The first multipart part is the attachment; its part name is not inspected, but it must carry a filename.
   * @returns UploadResponse Uploaded
   * @throws ApiError
   */
  public uploadProjectTestCaseStepAttachment({
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
      url: '/projects/{id}/test_cases/{case_id}/steps/{step_index}/attachments',
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
        413: `Every request is capped at \`TUCANO_MAX_BODY_BYTES\` (default 50 MiB) by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Delete a project test case step attachment
   * Removes the file and its metadata from the addressed step of the case the named project holds. An unattached filename answers `404`.
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteProjectTestCaseStepAttachment({
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
      url: '/projects/{id}/test_cases/{case_id}/steps/{step_index}/attachments/{filename}',
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
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the test runs a project owns
   * @returns string Test run IDs
   * @throws ApiError
   */
  public listProjectTestRuns({
    id,
    filter,
    tags,
    configuration,
  }: {
    id: string,
    /**
     * Case-insensitive substring filter for resource IDs
     */
    filter?: string,
    /**
     * Comma-separated tags; a resource matches when it carries at least one of them (case-insensitive). Resources without a tags array never match.
     */
    tags?: string,
    /**
     * Only meaningful for test_runs: keeps the runs that link the given configuration identifier. A configuration no run links yields an empty listing.
     */
    configuration?: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_runs',
      path: {
        'id': id,
      },
      query: {
        'filter': filter,
        'tags': tags,
        'configuration': configuration,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a test run in a project
   * Creates a run whose home is this project. The caller needs `editor` here and in every project the body's `projects` array names. This route creates only: unlike the suite and case routes it accepts no `mode`.
   * @returns CreateResponse Created
   * @throws ApiError
   */
  public addProjectTestRun({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestRunCreateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/test_runs',
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
   * Delete a test run a project owns
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public removeProjectTestRun({
    id,
    runId,
  }: {
    id: string,
    runId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}/test_runs/{run_id}',
      path: {
        'id': id,
        'run_id': runId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the milestones a project owns
   * @returns string Milestone IDs
   * @throws ApiError
   */
  public listProjectMilestones({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/milestones',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a milestone in a project
   * Creates a milestone whose home is this project. The caller needs `owner` here and in every project its `testSuiteIds` and `testRunIds` references reach, and a milestone that reaches no project is refused as `invalid_request`. This route creates only: unlike the suite and case routes it accepts no `mode`.
   * @returns CreateResponse Created
   * @throws ApiError
   */
  public addProjectMilestone({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: MilestoneCreateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/milestones',
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
   * Delete a milestone a project owns
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public removeProjectMilestone({
    id,
    milestoneId,
  }: {
    id: string,
    milestoneId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}/milestones/{milestone_id}',
      path: {
        'id': id,
        'milestone_id': milestoneId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the configurations a project owns
   * @returns string Configuration IDs
   * @throws ApiError
   */
  public listProjectConfigurations({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/configurations',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * Create a configuration in a project
   * Creates a configuration whose home is this project; the caller needs `editor` here. This route creates only: unlike the suite and case routes it accepts no `mode`.
   * @returns CreateResponse Created
   * @throws ApiError
   */
  public addProjectConfiguration({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestConfigurationCreateRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/projects/{id}/configurations',
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
   * Delete a configuration a project owns
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public removeProjectConfiguration({
    id,
    configId,
  }: {
    id: string,
    configId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/projects/{id}/configurations/{config_id}',
      path: {
        'id': id,
        'config_id': configId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\` and no longer than the 255 bytes one stored component may hold. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the releases available to the caller
   * The distinct `name` of every milestone in the projects the caller reaches, sorted byte-wise so the client can render the list as it arrives. A milestone stored in a project outside the caller's grants contributes nothing rather than refusing the request, and an installation that holds no milestone answers `[]` rather than an error.
   * @returns string Distinct milestone names, sorted byte-wise
   * @throws ApiError
   */
  public listReleases(): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/releases',
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
  /**
   * List the environments available to the caller
   * The distinct `name` of every test configuration in the projects the caller reaches, sorted byte-wise so the client can render the list as it arrives. A configuration stored in a project outside the caller's grants contributes nothing rather than refusing the request, and an installation that holds no configuration answers `[]` rather than an error.
   * @returns string Distinct configuration names, sorted byte-wise
   * @throws ApiError
   */
  public listEnvironments(): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/environments',
      errors: {
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        503: `\`service_unavailable\`: the request arrived while \`TUCANO_MAX_CONCURRENCY\` (default 128; an explicit \`0\` removes the cap) others were already in flight. The server refuses rather than queues, and the answer carries \`Retry-After\`.`,
        504: `\`request_timeout\`: the request outlived \`TUCANO_REQUEST_TIMEOUT_MS\` (default 300000 ms; an explicit \`0\` disables the deadline) and the server stopped waiting for it. A write already handed to the storage layer finishes atomically regardless of the cutoff, so a \`504\` answers 'unknown', never 'half done'.`,
      },
    });
  }
}
