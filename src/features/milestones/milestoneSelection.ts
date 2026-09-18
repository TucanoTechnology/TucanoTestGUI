import type {
  Milestone,
  MilestoneCreateRequest,
  MilestoneUpdateRequest,
  Project,
} from "../../api/generated/index.js";
import type { MilestoneFormValues } from "./MilestoneForm.js";

/** A suite a milestone can link, with the number of cases it carries. */
export interface MilestoneSuiteOption {
  suiteId: string;
  name: string;
  caseCount: number;
}

/** A run a milestone can link, named by the key the project holds it by. */
export interface MilestoneRunOption {
  id: string;
  name: string;
}

/** Everything a milestone belonging to one project can link. */
export interface MilestoneSelectionOptions {
  suites: MilestoneSuiteOption[];
  runs: MilestoneRunOption[];
}

export function buildMilestoneSelectionOptions(
  project: Project,
  runs: MilestoneRunOption[],
): MilestoneSelectionOptions {
  const suites = (project.testSuites ?? []).map((suite) => ({
    suiteId: suite.suiteId,
    name: suite.name,
    caseCount: (suite.testCases ?? []).length,
  }));

  return { suites, runs };
}

function sameIds(stored: string[], selected: string[]): boolean {
  return (
    stored.length === selected.length && selected.every((id) => stored.includes(id))
  );
}

export function buildMilestoneCreateRequest(
  values: MilestoneFormValues,
): MilestoneCreateRequest {
  return {
    name: values.name,
    // Only the fields that were filled in: the API rejects an unknown field and
    // stores a supplied empty string as the value, so a blank one is left out.
    ...(values.milestoneId ? { milestoneId: values.milestoneId } : {}),
    ...(values.description ? { description: values.description } : {}),
    ...(values.status ? { status: values.status } : {}),
    ...(values.startDate ? { startDate: values.startDate } : {}),
    ...(values.targetDate ? { targetDate: values.targetDate } : {}),
    ...(values.suiteIds.length > 0 ? { testSuiteIds: values.suiteIds } : {}),
    ...(values.runIds.length > 0 ? { testRunIds: values.runIds } : {}),
  };
}

/**
 * Only the fields the user changed: the API replaces the fields the body
 * carries and keeps every field it does not, so an emptied one is sent as an
 * empty string to clear it and an untouched one is left out.
 *
 * `milestoneId` is never one of them. The API writes a body `milestoneId` into
 * the document without moving the milestone, so an edit would leave the
 * resource answering under its old key with a different identifier stored
 * inside, and a rename never moves the key either way.
 */
export function buildMilestoneUpdateRequest(
  milestone: Milestone,
  values: MilestoneFormValues,
): MilestoneUpdateRequest {
  const requestBody: MilestoneUpdateRequest = {};

  if (values.name !== milestone.name) {
    requestBody.name = values.name;
  }
  if (values.description !== (milestone.description ?? "")) {
    requestBody.description = values.description;
  }
  if (values.status !== (milestone.status ?? "")) {
    requestBody.status = values.status;
  }
  if (values.startDate !== (milestone.startDate ?? "")) {
    requestBody.startDate = values.startDate;
  }
  if (values.targetDate !== (milestone.targetDate ?? "")) {
    requestBody.targetDate = values.targetDate;
  }
  // The links are a set: reordering them is not a change, and clearing them
  // altogether is sent as an empty list.
  if (!sameIds(milestone.testSuiteIds ?? [], values.suiteIds)) {
    requestBody.testSuiteIds = values.suiteIds;
  }
  if (!sameIds(milestone.testRunIds ?? [], values.runIds)) {
    requestBody.testRunIds = values.runIds;
  }

  return requestBody;
}
