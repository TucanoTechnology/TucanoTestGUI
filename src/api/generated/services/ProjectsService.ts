/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CompositionRequest } from '../models/CompositionRequest';
import type { CompositionResponse } from '../models/CompositionResponse';
import type { CreateResponse } from '../models/CreateResponse';
import type { DuplicateRequest } from '../models/DuplicateRequest';
import type { MessageResponse } from '../models/MessageResponse';
import type { MilestoneCreateRequest } from '../models/MilestoneCreateRequest';
import type { Project } from '../models/Project';
import type { ProjectCreateRequest } from '../models/ProjectCreateRequest';
import type { ProjectUpdateRequest } from '../models/ProjectUpdateRequest';
import type { TestConfigurationCreateRequest } from '../models/TestConfigurationCreateRequest';
import type { TestRunCreateRequest } from '../models/TestRunCreateRequest';
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
        400: `\`invalid_request\`: the body was rejected — an unknown or missing field, an identifier the body supplies that is not a single \`.json\` component, or a name-only payload that omits what creation needs.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        409: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
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
  }: {
    id: string,
  }): CancelablePromise<Project> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
  }: {
    id: string,
    requestBody: ProjectUpdateRequest,
  }): CancelablePromise<MessageResponse> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/projects/{id}',
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
        413: `Every request is capped at 50 MiB by the router, before the handler runs: the answer is plain text — \`length limit exceeded\` — never the error envelope. Because the router cap and the attachment cap are the same size, the \`payload_too_large\` envelope the API can still produce is unreachable for attachments, and this plain-text 413 is the only observable one.`,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
  /**
   * Duplicate resource
   * An unusable path identifier answers `invalid_request` here, where `POST /test_suites/{id}/duplicate` answers `invalid_id`. Unknown fields in the body are ignored.
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
   * List the test suites a project owns
   * @returns string Test suite IDs
   * @throws ApiError
   */
  public listProjectTestSuites({
    id,
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_suites',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_cases',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
  }: {
    id: string,
  }): CancelablePromise<Array<string>> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/projects/{id}/test_runs',
      path: {
        'id': id,
      },
      errors: {
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
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
        400: `\`invalid_id\`: an identifier must be a single path component ending in \`.json\`. Test cases are addressed verbatim and answer \`404\` instead, and the duplicate routes differ as their own descriptions record.`,
        401: `\`missing_token\`, \`invalid_token\` or \`token_expired\`: the \`Authorization\` header was absent or carried a token this deployment does not accept. The response carries the \`WWW-Authenticate\` challenge.`,
        403: `\`forbidden\`: the caller is authenticated but does not hold the role this operation needs on every project it reaches through. A caller that can reach nothing the operation touches is answered the same way, so the two are not distinguished. The projects a request reaches are resolved and checked before the resource itself is loaded, so this answer can precede the \`404\` a missing resource would draw; a deployment that does not enforce authentication skips the check and answers the ordinary \`404\` instead.`,
        404: `Structured error envelope: \`{"error": {"code": ..., "message": ...}}\``,
      },
    });
  }
}
