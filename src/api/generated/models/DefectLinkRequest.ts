/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The client-supplied half of a defect link. The API derives `linkId` and `linkedAt`, so a body that carries either — or any other unknown field — is rejected rather than silently ignored: a client that thought it was naming the link would otherwise never learn its identifier was thrown away. `defectUrl` must be an issue URL the named `trackerType` would use, and `trackerType` must be one of the four the API knows.
 */
export type DefectLinkRequest = {
  /**
   * The defect's identifier inside its tracker; a result may link a given `defectId` only once.
   */
  defectId: string;
  /**
   * An issue URL for `trackerType`: a `<org>.atlassian.net/browse/<KEY>` URL for `jira`, a `github.com/<owner>/<repo>/issues/<number>` URL for `github`, a `gitlab.com/<group>/<project>/-/issues/<number>` URL for `gitlab`, and any well-formed `https://` URL for `custom`. A query string or fragment is ignored.
   */
  defectUrl: string;
  trackerType: 'jira' | 'github' | 'gitlab' | 'custom';
  title?: string;
  status?: string;
};

