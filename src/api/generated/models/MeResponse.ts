/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * The account a token names, the authority the deployment reports for it, and the role it holds on each project. The authority is the token's: an account demoted since the token was minted keeps it until the token expires.
 */
export type MeResponse = {
  /**
   * The account id.
   */
  id: string;
  /**
   * The account's username.
   */
  username: string;
  /**
   * Whether the account is a system administrator.
   */
  systemAdmin: boolean;
  /**
   * Each project the account can reach, and the role it holds there.
   */
  roles: Record<string, string>;
};

