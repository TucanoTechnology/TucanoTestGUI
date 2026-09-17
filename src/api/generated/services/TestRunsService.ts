/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateResponse } from '../models/CreateResponse';
import type { DefectLink } from '../models/DefectLink';
import type { DefectLinkRequest } from '../models/DefectLinkRequest';
import type { DuplicateRunRequest } from '../models/DuplicateRunRequest';
import type { ImportEntry } from '../models/ImportEntry';
import type { ImportSummary } from '../models/ImportSummary';
import type { MessageResponse } from '../models/MessageResponse';
import type { TestResultRequest } from '../models/TestResultRequest';
import type { TestRun } from '../models/TestRun';
import type { TestRunUpdateRequest } from '../models/TestRunUpdateRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TestRunsService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}
  /**
   * Read a test run
   * @returns TestRun Test run document
   * @throws ApiError
   */
  public getTestRun({
    id,
  }: {
    id: string,
  }): CancelablePromise<TestRun> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_runs/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Update a test run
   * @returns MessageResponse Updated
   * @throws ApiError
   */
  public updateTestRun({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestRunUpdateRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/test_runs/{id}',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Delete a test run
   * @returns MessageResponse Deleted
   * @throws ApiError
   */
  public deleteTestRun({
    id,
  }: {
    id: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_runs/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Duplicate test run without its results
   * Unknown fields in the body are ignored.
   * @returns CreateResponse Duplicated
   * @throws ApiError
   */
  public duplicateTestRun({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: DuplicateRunRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/duplicate',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Add test suite to run
   * A run is a point-in-time snapshot, never a home: the suite is recorded as a copy and keeps the project that owns it, so this does not relocate the source. An unusable path identifier or `suiteId` answers `invalid_id`.
   * @returns MessageResponse Added
   * @throws ApiError
   */
  public addTestRunTestSuite({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: {
      suiteId: string;
    },
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/test_suites',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Add test case to run
   * A run is a point-in-time snapshot, never a home: the case is recorded as a copy and keeps the project or suite that owns it, so this does not relocate the source. An unusable path identifier answers `invalid_id`.
   * @returns MessageResponse Added
   * @throws ApiError
   */
  public addTestRunTestCase({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: {
      testCaseId: string;
    },
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/test_cases',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Record test case execution result in run
   * @returns MessageResponse Recorded
   * @throws ApiError
   */
  public recordTestRunResult({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: TestResultRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/results',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an unusable identifier, \`invalid_request\` for a missing or rejected field, or \`invalid_status\` when \`status\` is not \`Passed\`, \`Failed\`, \`Blocked\`, \`Untested\` or \`Retest\`.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * List the defects linked to a run result
   * Returns the defect links recorded on the result a run holds for `case_id`. An unusable run identifier answers `invalid_id`, and a run that does not exist or records no result for that case answers `404`, so an empty list means the result exists but has no linked defect.
   * @returns any Defect links recorded on one run result
   * @throws ApiError
   */
  public listResultDefects({
    id,
    caseId,
  }: {
    id: string,
    caseId: string,
  }): CancelablePromise<{
    defects: Array<DefectLink>;
  }> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/test_runs/{id}/results/{case_id}/defects',
      path: {
        'id': id,
        'case_id': caseId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Link a defect to a run result
   * Records a defect link on the result a run holds for `case_id`. The API derives the link identifier and the linked-at timestamp, so a body carrying either is rejected rather than silently ignored. `defectUrl` must be an issue URL the named `trackerType` would use: `jira` a `<org>.atlassian.net/browse/<KEY>` URL, `github` a `github.com/<owner>/<repo>/issues/<number>` URL, `gitlab` a `gitlab.com/<group>/<project>/-/issues/<number>` URL, and `custom` any well-formed `https://` URL. A `defectId` the result already links answers `409` rather than adding a second link.
   * @returns CreateResponse Defect link recorded
   * @throws ApiError
   */
  public linkResultDefect({
    id,
    caseId,
    requestBody,
  }: {
    id: string,
    caseId: string,
    requestBody: DefectLinkRequest,
  }): CancelablePromise<CreateResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/results/{case_id}/defects',
      path: {
        'id': id,
        'case_id': caseId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Unlink a defect from a run result
   * Removes the defect link a result carries under `link_id`. The identifier is the one the link route returned and is an opaque string, not a stored document name, so it is not validated as one. An unknown run or result, or a result that does not carry that link, answers `404`.
   * @returns MessageResponse Unlinked
   * @throws ApiError
   */
  public unlinkResultDefect({
    id,
    caseId,
    linkId,
  }: {
    id: string,
    caseId: string,
    /**
     * Identifier of a defect link, as returned by the route that recorded it. It is an opaque string the API derives, not a stored document name, so it is never validated as one.
     */
    linkId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_runs/{id}/results/{case_id}/defects/{link_id}',
      path: {
        'id': id,
        'case_id': caseId,
        'link_id': linkId,
      },
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Import JUnit XML results into a run
   * Reads a JUnit XML report and records a result for every `<testcase>` it can name at any depth, mapping a failure or error to `Failed`, a skip to `Blocked` and anything else to `Passed`. A case the run already records is counted as a duplicate and left untouched, and a case carrying no `name` is counted as an error, so a partly unusable report still imports the part that is not. The body must be UTF-8 and well-formed XML; anything else answers `invalid_request`.
   * @returns ImportSummary Import summary
   * @throws ApiError
   */
  public importJUnitResults({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: string,
  }): CancelablePromise<ImportSummary> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/import/junit',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/xml',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Import JSON results into a run
   * Reads a JSON array of results — or an object whose only field `results` holds that array — and records one result per entry, each becoming the same `TestCaseResult` the single-result route writes. An entry's `timestamp` is stored verbatim and defaults to the current time; `notes` is optional. The body is strict: malformed JSON, an entry that is not an object, an unknown or misspelled field, a missing or empty `testCaseId` or `status`, or a `status` that is not `Passed`, `Failed` or `Blocked` answers `invalid_request` (or `invalid_status`) and nothing is written, because the whole body is parsed before the run is touched. A case the run already records is counted as a duplicate and left untouched.
   * @returns ImportSummary Import summary
   * @throws ApiError
   */
  public importJsonResults({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: (Array<ImportEntry> | {
      results: Array<ImportEntry>;
    }),
  }): CancelablePromise<ImportSummary> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/import/json',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an unusable identifier, \`invalid_request\` for a body that is not a JSON results array or an entry that is not an object, omits or misspells a field, or supplies an empty \`testCaseId\`, or \`invalid_status\` when an entry's \`status\` is not \`Passed\`, \`Failed\` or \`Blocked\`.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Link a configuration to a run
   * A run references the top-level configuration instead of embedding a copy of it, so the link records the configuration's identifier and name. An unusable run or `configId` answers `invalid_id`, an unknown one answers `404`, and linking a configuration the run already references answers `409`.
   * @returns MessageResponse Linked
   * @throws ApiError
   */
  public addTestRunConfiguration({
    id,
    requestBody,
  }: {
    id: string,
    requestBody: {
      configId: string;
    },
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/test_runs/{id}/configurations',
      path: {
        'id': id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `\`invalid_id\` for an identifier in the path or the body that is not a single \`.json\` component, or \`invalid_request\` for a rejected body.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
      },
    });
  }
  /**
   * Unlink a configuration from a run
   * Removes the run's reference to the configuration. An unusable run identifier answers `invalid_id`, and a configuration the run does not reference answers `404`.
   * @returns MessageResponse Unlinked
   * @throws ApiError
   */
  public removeTestRunConfiguration({
    id,
    configId,
  }: {
    id: string,
    configId: string,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'DELETE',
      url: '/test_runs/{id}/configurations/{config_id}',
      path: {
        'id': id,
        'config_id': configId,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
}
