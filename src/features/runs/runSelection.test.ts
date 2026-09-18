import { describe, expect, it } from "vitest";
import type {
  Project,
  TestConfiguration,
  TestRun,
} from "../../api/generated/index.js";
import type { RunFormValues } from "./RunForm.js";
import {
  buildRunCreateRequest,
  buildRunSelectionOptions,
  buildRunUpdateRequest,
} from "./runSelection.js";

const PROJECT: Project = {
  projectId: "checkout.json",
  name: "Checkout",
  testSuites: [
    {
      suiteId: "smoke.checkout.json",
      name: "Checkout smoke",
      testCases: [
        {
          testCaseId: "TC-LOGIN-1",
          title: "Log in",
          expectedResult: "The account page opens",
          version: 1,
        },
        {
          testCaseId: "TC-CART-1",
          title: "Add to cart",
          expectedResult: "The cart holds one item",
          version: 1,
        },
      ],
    },
    {
      suiteId: "payments.checkout.json",
      name: "Checkout payments",
      testCases: [
        {
          testCaseId: "TC-LOGIN-2",
          title: "Pay with a saved card",
          expectedResult: "The order is placed",
          version: 3,
        },
      ],
    },
  ],
  testCases: [
    {
      testCaseId: "TC-PROJECT-1",
      title: "Project level case",
      expectedResult: "It holds",
      version: 2,
    },
    // The same identifier a suite already carries, at a newer revision.
    {
      testCaseId: "TC-LOGIN-1",
      title: "Log in",
      expectedResult: "The account page opens",
      version: 4,
    },
  ],
};

const CONFIGURATIONS: TestConfiguration[] = [
  { configId: "chrome-linux.json", name: "Chrome on Linux" },
  { configId: "firefox-windows.json", name: "Firefox on Windows" },
];

const RUN: TestRun = {
  testRunId: "nightly.json",
  name: "Nightly run",
  timestamp: "1750000000",
  tags: ["nightly"],
  projects: [{ projectId: "checkout.json", name: "Checkout", testSuites: [] }],
  configurations: [{ configId: "chrome-linux.json", name: "chrome-linux" }],
};

const EMPTY_VALUES: RunFormValues = {
  name: "",
  tags: [],
  configId: "",
  suiteIds: [],
  caseIds: [],
};

/** The form as it opens on `RUN`, so an untouched field reads as unchanged. */
const STORED_VALUES: RunFormValues = {
  name: "Nightly run",
  tags: ["nightly"],
  configId: "chrome-linux.json",
  suiteIds: [],
  caseIds: [],
};

function options() {
  return buildRunSelectionOptions(PROJECT, CONFIGURATIONS);
}

function values(overrides: Partial<RunFormValues> = {}): RunFormValues {
  return { ...STORED_VALUES, ...overrides };
}

/** The create form as it opens: nothing selected and nothing typed. */
function createValues(overrides: Partial<RunFormValues> = {}): RunFormValues {
  return { ...EMPTY_VALUES, ...overrides };
}

describe("buildRunSelectionOptions", () => {
  it("offers project cases first, then suite cases, each identifier once", () => {
    const built = options();

    expect(
      built.cases.map((option) => [option.testCase.testCaseId, option.source]),
    ).toEqual([
      ["TC-PROJECT-1", null],
      ["TC-LOGIN-1", null],
      ["TC-CART-1", "Checkout smoke"],
      ["TC-LOGIN-2", "Checkout payments"],
    ]);
    expect(built.suites.map((suite) => suite.suiteId)).toEqual([
      "smoke.checkout.json",
      "payments.checkout.json",
    ]);
    expect(built.configurations).toBe(CONFIGURATIONS);
    expect(built.project).toBe(PROJECT);
  });

  it("tolerates a project with neither suites nor cases", () => {
    const built = buildRunSelectionOptions(
      { projectId: "empty.json", name: "Empty" },
      [],
    );

    expect(built.suites).toEqual([]);
    expect(built.cases).toEqual([]);
    expect(built.configurations).toEqual([]);
  });
});

describe("buildRunCreateRequest", () => {
  it("copies the selected suites and cases, and pins their revisions", () => {
    const request = buildRunCreateRequest(
      createValues({
        name: "Nightly",
        tags: ["nightly"],
        configId: "chrome-linux.json",
        suiteIds: ["smoke.checkout.json"],
        caseIds: ["TC-PROJECT-1"],
      }),
      options(),
    );

    expect(request.name).toBe("Nightly");
    expect(request.projects).toEqual([
      { projectId: "checkout.json", name: "Checkout", testSuites: [] },
    ]);
    expect(request.testSuites?.map((suite) => suite.suiteId)).toEqual([
      "smoke.checkout.json",
    ]);
    expect(request.testCases?.map((testCase) => testCase.testCaseId)).toEqual([
      "TC-PROJECT-1",
    ]);
    // The API copies what it is handed but never pins revisions itself.
    expect(request.caseVersions).toEqual({
      "TC-LOGIN-1": 1,
      "TC-CART-1": 1,
      "TC-PROJECT-1": 2,
    });
    expect(request.configurations).toEqual([
      { configId: "chrome-linux.json", name: "Chrome on Linux" },
    ]);
    expect(request.tags).toEqual(["nightly"]);
  });

  it("pins the explicitly selected copy of a case over the suite copy", () => {
    const request = buildRunCreateRequest(
      createValues({
        name: "Nightly",
        suiteIds: ["smoke.checkout.json"],
        caseIds: ["TC-LOGIN-1"],
      }),
      options(),
    );

    expect(request.testCases?.map((testCase) => testCase.testCaseId)).toEqual([
      "TC-LOGIN-1",
    ]);
    expect(request.caseVersions).toEqual({
      "TC-LOGIN-1": 4,
      "TC-CART-1": 1,
    });
  });

  it("omits every empty optional instead of sending a null placeholder", () => {
    const request = buildRunCreateRequest(
      createValues({ name: "Ad hoc" }),
      options(),
    );

    // The wire carries the JSON, so only the fields that were set survive.
    expect(JSON.parse(JSON.stringify(request))).toEqual({
      name: "Ad hoc",
      projects: [
        { projectId: "checkout.json", name: "Checkout", testSuites: [] },
      ],
    });
  });

  it("ignores a selection that names something the project no longer holds", () => {
    const request = buildRunCreateRequest(
      createValues({
        name: "Nightly",
        suiteIds: ["gone.checkout.json"],
        caseIds: ["TC-GONE-1"],
      }),
      options(),
    );

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      name: "Nightly",
      projects: [
        { projectId: "checkout.json", name: "Checkout", testSuites: [] },
      ],
    });
  });
});

describe("buildRunUpdateRequest", () => {
  it("sends nothing when no field changed", () => {
    expect(
      buildRunUpdateRequest(
        RUN,
        values({
          name: "Nightly run",
          tags: ["nightly"],
          configId: "chrome-linux.json",
        }),
        CONFIGURATIONS,
      ),
    ).toEqual({});
  });

  it("sends only the fields that differ", () => {
    expect(
      buildRunUpdateRequest(RUN, values({ name: "Nightly v2", tags: ["nightly"], configId: "chrome-linux.json" }), CONFIGURATIONS),
    ).toEqual({ name: "Nightly v2" });
    expect(
      buildRunUpdateRequest(RUN, values({ name: "Nightly run", tags: ["smoke"], configId: "chrome-linux.json" }), CONFIGURATIONS),
    ).toEqual({ tags: ["smoke"] });
  });

  it("notices a reordered or emptied tag list", () => {
    const run: TestRun = { ...RUN, tags: ["web", "smoke"] };

    expect(
      buildRunUpdateRequest(run, values({ name: run.name, tags: ["smoke", "web"] }), []),
    ).toEqual({ tags: ["smoke", "web"] });
    expect(
      buildRunUpdateRequest(run, values({ name: run.name, tags: [] }), []),
    ).toEqual({ tags: [] });
  });

  it("names the newly linked configuration from the document, not the run", () => {
    expect(
      buildRunUpdateRequest(
        RUN,
        values({ name: RUN.name, configId: "firefox-windows.json" }),
        CONFIGURATIONS,
      ),
    ).toEqual({
      configurations: [
        { configId: "firefox-windows.json", name: "Firefox on Windows" },
      ],
    });
  });

  it("clears the linked configuration with an empty list", () => {
    expect(
      buildRunUpdateRequest(
        RUN,
        values({ name: RUN.name, configId: "" }),
        CONFIGURATIONS,
      ),
    ).toEqual({ configurations: [] });
  });

  it("treats a run that links nothing as unconfigured", () => {
    const run: TestRun = { ...RUN, configurations: [] };

    expect(
      buildRunUpdateRequest(run, values({ configId: "" }), CONFIGURATIONS),
    ).toEqual({});
  });
});
