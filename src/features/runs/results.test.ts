import { describe, expect, it } from "vitest";
import type {
  Attachment,
  DefectLink,
  TestCaseResult,
  TestRun,
} from "../../api/generated/index.js";
import {
  buildResultRequest,
  buildResultRows,
  formatDuration,
  formatDurationSeconds,
  parseDurationSeconds,
  rerecordBlocker,
} from "./results.js";

const RESULT: TestCaseResult = {
  testCaseId: "TC-LOGIN-1",
  status: "Failed",
  timestamp: "1789655960",
  notes: "lock message missing",
  durationMs: 800,
};

const DEFECT: DefectLink = {
  linkId: "link-1",
  defectId: "OPS-1",
  defectUrl: "https://acme.atlassian.net/browse/OPS-1",
  trackerType: "jira",
  linkedAt: "1789655960",
};

const ATTACHMENT: Attachment = {
  filename: "log-1789655960.txt",
  originalName: "log.txt",
  mimeType: "text/plain",
  size: 2048,
};

const RUN: TestRun = {
  testRunId: "nightly.json",
  name: "Nightly run",
  timestamp: "1750000000",
  testCases: [
    {
      testCaseId: "TC-LOGIN-1",
      title: "Log in",
      expectedResult: "The account page opens",
    },
    {
      testCaseId: "TC-LOGIN-2",
      title: "Reject a bad password",
      expectedResult: "The message names the password",
    },
  ],
  results: [RESULT],
};

describe("buildResultRows", () => {
  it("lists the run's cases in order, each with the result it records", () => {
    const rows = buildResultRows(RUN);

    expect(rows.map((row) => [row.testCaseId, row.title, row.status])).toEqual([
      ["TC-LOGIN-1", "Log in", "Failed"],
      ["TC-LOGIN-2", "Reject a bad password", "Untested"],
    ]);
    expect(rows[0]?.result).toBe(RESULT);
    expect(rows[1]?.result).toBeUndefined();
  });

  it("carries a result the run records for a case it does not hold", () => {
    const rows = buildResultRows({
      ...RUN,
      results: [RESULT, { ...RESULT, testCaseId: "TC-GONE-1", status: "Passed" }],
    });

    expect(rows.map((row) => [row.testCaseId, row.title, row.status])).toEqual([
      ["TC-LOGIN-1", "Log in", "Failed"],
      ["TC-LOGIN-2", "Reject a bad password", "Untested"],
      ["TC-GONE-1", undefined, "Passed"],
    ]);
  });

  it("tolerates a run that holds neither cases nor results", () => {
    expect(
      buildResultRows({
        testRunId: "empty.json",
        name: "Empty run",
        timestamp: "0",
      }),
    ).toEqual([]);
  });

  it("reads a case the run holds twice as one row", () => {
    const rows = buildResultRows({
      ...RUN,
      testCases: [
        { testCaseId: "TC-LOGIN-1", title: "Log in", expectedResult: "It opens" },
        {
          testCaseId: "TC-LOGIN-1",
          title: "Log in, again",
          expectedResult: "It still opens",
        },
      ],
    });

    expect(rows.map((row) => row.testCaseId)).toEqual([
      "TC-LOGIN-1",
      "TC-LOGIN-1",
    ]);
  });
});

describe("formatDuration", () => {
  it("reads an absent duration as a dash", () => {
    expect(formatDuration(undefined)).toBe("—");
  });

  it("keeps a sub-second duration in milliseconds", () => {
    expect(formatDuration(0)).toBe("0 ms");
    expect(formatDuration(1)).toBe("1 ms");
    expect(formatDuration(999)).toBe("999 ms");
  });

  it("reads seconds up to the minute", () => {
    expect(formatDuration(1000)).toBe("1 s");
    expect(formatDuration(2500)).toBe("2.5 s");
    expect(formatDuration(59500)).toBe("59.5 s");
  });

  it("reads whole minutes from the minute up", () => {
    expect(formatDuration(60000)).toBe("1 m 0 s");
    expect(formatDuration(63000)).toBe("1 m 3 s");
    expect(formatDuration(90500)).toBe("1 m 30.5 s");
    expect(formatDuration(3600000)).toBe("60 m 0 s");
  });
});

describe("formatDurationSeconds", () => {
  it("reads an absent duration as an empty field", () => {
    expect(formatDurationSeconds(undefined)).toBe("");
  });

  it("reads the stored milliseconds back as seconds", () => {
    expect(formatDurationSeconds(0)).toBe("0");
    expect(formatDurationSeconds(800)).toBe("0.8");
    expect(formatDurationSeconds(2500)).toBe("2.5");
    expect(formatDurationSeconds(90000)).toBe("90");
  });
});

describe("parseDurationSeconds", () => {
  it("leaves a blank field out of the request", () => {
    expect(parseDurationSeconds("")).toEqual({
      durationMs: undefined,
      error: null,
    });
    expect(parseDurationSeconds("   ")).toEqual({
      durationMs: undefined,
      error: null,
    });
  });

  it("reads a whole or fractional number of seconds", () => {
    expect(parseDurationSeconds("0")).toEqual({ durationMs: 0, error: null });
    expect(parseDurationSeconds("120")).toEqual({
      durationMs: 120000,
      error: null,
    });
    expect(parseDurationSeconds("2.5")).toEqual({
      durationMs: 2500,
      error: null,
    });
    expect(parseDurationSeconds(" 0.8 ")).toEqual({
      durationMs: 800,
      error: null,
    });
  });

  it("refuses anything that is not a number of seconds", () => {
    for (const value of ["-5", "abc", "1e3", "2,5", "3s", "NaN"]) {
      const parsed = parseDurationSeconds(value);

      expect(parsed.durationMs).toBeUndefined();
      expect(parsed.error).toBe(
        "Enter the duration in seconds, or leave it blank.",
      );
    }
  });

  it("refuses a duration too long for the API to store", () => {
    const parsed = parseDurationSeconds("1000000000000000");

    expect(parsed.durationMs).toBeUndefined();
    expect(parsed.error).toBe("That duration is too long to store.");
  });
});

describe("buildResultRequest", () => {
  it("records the status with the comment and duration the form holds", () => {
    expect(
      buildResultRequest("TC-LOGIN-2", {
        status: "Passed",
        notes: "  it holds  ",
        durationMs: 2500,
      }),
    ).toEqual({
      testCaseId: "TC-LOGIN-2",
      status: "Passed",
      notes: "it holds",
      durationMs: 2500,
    });
  });

  it("leaves an empty comment and duration out, which clears them", () => {
    const request = buildResultRequest("TC-LOGIN-1", {
      status: "Blocked",
      notes: "   ",
    });

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      testCaseId: "TC-LOGIN-1",
      status: "Blocked",
    });
  });

  it("sends the stored timestamp back so an edit cannot re-date the result", () => {
    expect(
      buildResultRequest("TC-LOGIN-1", { status: "Passed", notes: "" }, RESULT),
    ).toEqual({
      testCaseId: "TC-LOGIN-1",
      status: "Passed",
      timestamp: "1789655960",
    });
  });

  it("sends no timestamp for a result that holds none", () => {
    const request = buildResultRequest(
      "TC-LOGIN-1",
      { status: "Untested", notes: "retested" },
      { ...RESULT, timestamp: "" },
    );

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      testCaseId: "TC-LOGIN-1",
      status: "Untested",
      notes: "retested",
    });
  });
});

describe("rerecordBlocker", () => {
  it("blocks nothing while the result carries no defect link or attachment", () => {
    expect(rerecordBlocker(undefined)).toBeNull();
    expect(rerecordBlocker(RESULT)).toBeNull();
  });

  it("names the links a re-record would discard", () => {
    const blocked = rerecordBlocker({
      ...RESULT,
      defectLinks: [DEFECT, { ...DEFECT, linkId: "link-2", defectId: "OPS-2" }],
    });

    expect(blocked).toContain("2 linked defects");
    expect(blocked).toContain("TucanoTestAPI#284");
  });

  it("names a lone linked defect in the singular", () => {
    expect(rerecordBlocker({ ...RESULT, defectLinks: [DEFECT] })).toContain(
      "1 linked defect.",
    );
  });

  it("blocks a re-record of a result that carries an attachment", () => {
    const blocked = rerecordBlocker({
      ...RESULT,
      attachments: [ATTACHMENT],
    });

    expect(blocked).toContain("1 attachment");
    expect(blocked).toContain("TucanoTestAPI#284");
  });

  it("names both counts when the result carries both", () => {
    const blocked = rerecordBlocker({
      ...RESULT,
      defectLinks: [DEFECT],
      attachments: [
        ATTACHMENT,
        { ...ATTACHMENT, filename: "trace-1789655960.txt" },
      ],
    });

    expect(blocked).toContain("1 linked defect and 2 attachments");
  });
});
