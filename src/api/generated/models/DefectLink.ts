/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * A reference from a run result to the defect a failure raised. `trackerType` names the system the defect lives in — `jira`, `github`, `gitlab` or `custom` — and `defectUrl` is the address a human follows to reach it. `linkId` is the link's own identity, so the same defect can be linked and unlinked without depending on its position in the list.
 */
export type DefectLink = {
  /**
   * The link's own identity, independent of the defect it names
   */
  linkId: string;
  /**
   * The defect's identifier inside its tracker
   */
  defectId: string;
  /**
   * Where the defect can be read
   */
  defectUrl: string;
  trackerType: 'jira' | 'github' | 'gitlab' | 'custom';
  title?: string;
  status?: string;
  /**
   * Unix seconds rendered as a string, or a value stored verbatim.
   */
  linkedAt: string;
};

