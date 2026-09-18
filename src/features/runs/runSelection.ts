import type {
  Project,
  TestCase,
  TestConfiguration,
  TestRun,
  TestRunCreateRequest,
  TestRunUpdateRequest,
  TestSuite,
} from "../../api/generated/index.js";
import type { RunFormValues } from "./RunForm.js";

/** A case a run can cover, and the suite that carries it when one does. */
export interface RunCaseOption {
  testCase: TestCase;
  source: string | null;
}

/** Everything a run belonging to one project can select. */
export interface RunSelectionOptions {
  project: Project;
  suites: TestSuite[];
  cases: RunCaseOption[];
  configurations: TestConfiguration[];
}

export function buildRunSelectionOptions(
  project: Project,
  configurations: TestConfiguration[],
): RunSelectionOptions {
  const suites = project.testSuites ?? [];
  const candidates: RunCaseOption[] = [
    ...(project.testCases ?? []).map((testCase) => ({
      testCase,
      source: null,
    })),
    ...suites.flatMap((suite) =>
      (suite.testCases ?? []).map((testCase) => ({
        testCase,
        source: suite.name,
      })),
    ),
  ];

  // One checkbox per identifier: a case reachable both directly and through a
  // suite is still a single case, and the run stores one copy either way.
  const seen = new Set<string>();
  const cases = candidates.filter((option) => {
    const id = option.testCase.testCaseId;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return { project, suites, cases, configurations };
}

function pinnedVersions(options: RunSelectionOptions, values: RunFormValues) {
  const versions: Record<string, number> = {};

  // The cases a selected suite carries arrive only through the suite copy, and
  // the copy that carries them is the one the run records.
  for (const suite of options.suites) {
    if (!values.suiteIds.includes(suite.suiteId)) continue;
    for (const testCase of suite.testCases ?? []) {
      if (testCase.testCaseId) versions[testCase.testCaseId] = testCase.version ?? 1;
    }
  }

  // An explicitly selected case wins over the same case seen through a suite,
  // because that is the copy the run stores.
  for (const option of options.cases) {
    if (!values.caseIds.includes(option.testCase.testCaseId)) continue;
    versions[option.testCase.testCaseId] = option.testCase.version ?? 1;
  }

  return versions;
}

export function buildRunCreateRequest(
  values: RunFormValues,
  options: RunSelectionOptions,
): TestRunCreateRequest {
  const suites = options.suites.filter((suite) =>
    values.suiteIds.includes(suite.suiteId),
  );
  const cases = options.cases
    .filter((option) => values.caseIds.includes(option.testCase.testCaseId))
    .map((option) => option.testCase);

  return {
    name: values.name,
    projects: [
      {
        projectId: options.project.projectId,
        name: options.project.name,
        testSuites: [],
      },
    ],
    testSuites: suites.length > 0 ? suites : undefined,
    testCases: cases.length > 0 ? cases : undefined,
    // The API copies the suites and cases it is handed but never pins their
    // revisions, so the run carries the map it wants stored.
    caseVersions:
      suites.length > 0 || cases.length > 0
        ? pinnedVersions(options, values)
        : undefined,
    configurations: values.configId
      ? options.configurations
          .filter((configuration) => configuration.configId === values.configId)
          .map((configuration) => ({
            configId: configuration.configId,
            name: configuration.name,
          }))
      : undefined,
    tags: values.tags.length > 0 ? values.tags : undefined,
  };
}

export function buildRunUpdateRequest(
  run: TestRun,
  values: RunFormValues,
  configurations: TestConfiguration[],
): TestRunUpdateRequest {
  const requestBody: TestRunUpdateRequest = {};
  const storedTags = run.tags ?? [];
  const storedConfigId = run.configurations?.[0]?.configId ?? "";

  if (values.name !== run.name) {
    requestBody.name = values.name;
  }
  if (
    values.tags.length !== storedTags.length ||
    values.tags.some((tag, index) => tag !== storedTags[index])
  ) {
    requestBody.tags = values.tags;
  }
  // A run links at most one configuration, and an empty array clears it while
  // leaving the rest of the stored run alone.
  if (values.configId !== storedConfigId) {
    const configuration = configurations.find(
      (entry) => entry.configId === values.configId,
    );
    requestBody.configurations = configuration
      ? [{ configId: configuration.configId, name: configuration.name }]
      : [];
  }

  return requestBody;
}
