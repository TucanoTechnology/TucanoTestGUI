import { describe, expect, it } from "vitest";
import type { Milestone, Project } from "../../api/generated/index.js";
import type { MilestoneFormValues } from "./MilestoneForm.js";
import {
  buildMilestoneCreateRequest,
  buildMilestoneSelectionOptions,
  buildMilestoneUpdateRequest,
} from "./milestoneSelection.js";

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
        },
        {
          testCaseId: "TC-CART-1",
          title: "Add to cart",
          expectedResult: "The cart holds one item",
        },
      ],
    },
    { suiteId: "empty.checkout.json", name: "Checkout empty" },
  ],
};

const RUNS = [
  { id: "nightly.json", name: "Nightly run" },
  { id: "imported.json", name: "imported.json" },
];

const MILESTONE: Milestone = {
  milestoneId: "v1.0.json",
  name: "Checkout GA",
  description: "Ship the checkout flow.",
  status: "in_progress",
  startDate: "2026-09-01",
  targetDate: "2026-10-01",
  testSuiteIds: ["smoke.checkout.json"],
  testRunIds: ["nightly.json"],
};

/** The form as it opens on `MILESTONE`, so an untouched field reads unchanged. */
const STORED_VALUES: MilestoneFormValues = {
  name: "Checkout GA",
  description: "Ship the checkout flow.",
  status: "in_progress",
  startDate: "2026-09-01",
  targetDate: "2026-10-01",
  milestoneId: "",
  suiteIds: ["smoke.checkout.json"],
  runIds: ["nightly.json"],
};

/** The create form as it opens: nothing typed and nothing selected. */
const EMPTY_VALUES: MilestoneFormValues = {
  name: "",
  description: "",
  status: "",
  startDate: "",
  targetDate: "",
  milestoneId: "",
  suiteIds: [],
  runIds: [],
};

function values(overrides: Partial<MilestoneFormValues> = {}) {
  return { ...STORED_VALUES, ...overrides };
}

function createValues(overrides: Partial<MilestoneFormValues> = {}) {
  return { ...EMPTY_VALUES, ...overrides };
}

describe("buildMilestoneSelectionOptions", () => {
  it("counts the cases each suite carries and keeps the runs it is given", () => {
    const options = buildMilestoneSelectionOptions(PROJECT, RUNS);

    expect(options.suites).toEqual([
      { suiteId: "smoke.checkout.json", name: "Checkout smoke", caseCount: 2 },
      { suiteId: "empty.checkout.json", name: "Checkout empty", caseCount: 0 },
    ]);
    expect(options.runs).toBe(RUNS);
  });

  it("tolerates a project that holds no suite", () => {
    const options = buildMilestoneSelectionOptions(
      { projectId: "empty.json", name: "Empty" },
      [],
    );

    expect(options.suites).toEqual([]);
    expect(options.runs).toEqual([]);
  });
});

describe("buildMilestoneCreateRequest", () => {
  it("sends the fields that were filled in and the links that were selected", () => {
    const request = buildMilestoneCreateRequest(
      createValues({
        name: "Checkout GA",
        milestoneId: "v1.0",
        description: "Ship the checkout flow.",
        status: "in_progress",
        startDate: "2026-09-01",
        targetDate: "2026-10-01",
        suiteIds: ["smoke.checkout.json"],
        runIds: ["nightly.json"],
      }),
    );

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      name: "Checkout GA",
      milestoneId: "v1.0",
      description: "Ship the checkout flow.",
      status: "in_progress",
      startDate: "2026-09-01",
      targetDate: "2026-10-01",
      testSuiteIds: ["smoke.checkout.json"],
      testRunIds: ["nightly.json"],
    });
  });

  it("omits every empty optional instead of sending a blank placeholder", () => {
    const request = buildMilestoneCreateRequest(
      createValues({ name: "Ad hoc" }),
    );

    // The wire carries the JSON, so only the fields that were set survive.
    expect(JSON.parse(JSON.stringify(request))).toEqual({ name: "Ad hoc" });
  });
});

describe("buildMilestoneUpdateRequest", () => {
  it("sends nothing when no field changed", () => {
    expect(buildMilestoneUpdateRequest(MILESTONE, values())).toEqual({});
  });

  it("sends only the fields that differ", () => {
    expect(
      buildMilestoneUpdateRequest(MILESTONE, values({ name: "Checkout v1.0" })),
    ).toEqual({ name: "Checkout v1.0" });
    expect(
      buildMilestoneUpdateRequest(MILESTONE, values({ status: "completed" })),
    ).toEqual({ status: "completed" });
    expect(
      buildMilestoneUpdateRequest(MILESTONE, values({ targetDate: "2026-11-01" })),
    ).toEqual({ targetDate: "2026-11-01" });
  });

  it("clears a field the user emptied with an empty string", () => {
    expect(
      buildMilestoneUpdateRequest(
        MILESTONE,
        values({ description: "", status: "", startDate: "", targetDate: "" }),
      ),
    ).toEqual({
      description: "",
      status: "",
      startDate: "",
      targetDate: "",
    });
  });

  it("treats a field the document does not carry as empty", () => {
    const milestone: Milestone = { milestoneId: "m2", name: "Bare" };

    expect(buildMilestoneUpdateRequest(milestone, values({
      name: "Bare",
      description: "",
      status: "",
      startDate: "",
      targetDate: "",
      suiteIds: [],
      runIds: [],
    }))).toEqual({});
  });

  it("does not treat a reordered link as a change but does notice a new one", () => {
    const milestone: Milestone = {
      ...MILESTONE,
      testSuiteIds: ["smoke.checkout.json", "empty.checkout.json"],
    };

    expect(
      buildMilestoneUpdateRequest(
        milestone,
        values({
          suiteIds: ["empty.checkout.json", "smoke.checkout.json"],
        }),
      ),
    ).toEqual({});
    expect(
      buildMilestoneUpdateRequest(
        milestone,
        values({
          suiteIds: ["empty.checkout.json", "smoke.checkout.json", "new.json"],
        }),
      ),
    ).toEqual({
      testSuiteIds: ["empty.checkout.json", "smoke.checkout.json", "new.json"],
    });
  });

  it("clears the links with an empty list", () => {
    expect(
      buildMilestoneUpdateRequest(
        MILESTONE,
        values({ suiteIds: [], runIds: [] }),
      ),
    ).toEqual({ testSuiteIds: [], testRunIds: [] });
  });

  it("never sends the identifier, which would not move the milestone", () => {
    const request = buildMilestoneUpdateRequest(
      MILESTONE,
      values({ milestoneId: "another.json" }),
    );

    expect(request).toEqual({});
    expect("milestoneId" in request).toBe(false);
  });
});
