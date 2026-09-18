import { describe, expect, it } from "vitest";
import type { ImportSummary } from "../../api/generated/index.js";
import {
  buildImportRequest,
  describeImportSummary,
  ImportFileError,
} from "./importResults.js";

const SUMMARY: ImportSummary = {
  imported: 3,
  skipped: 0,
  errors: 0,
  duplicates: 0,
  summary: { passed: 2, failed: 1, blocked: 0 },
};

describe("buildImportRequest", () => {
  it("parses a JSON array of entries", () => {
    const request = buildImportRequest(
      "json",
      '[{"testCaseId":"TC-LOGIN-1","status":"Passed"}]',
    );

    expect(request).toEqual({
      format: "json",
      body: [{ testCaseId: "TC-LOGIN-1", status: "Passed" }],
    });
  });

  it("keeps the results wrapper a JSON file may carry", () => {
    const request = buildImportRequest(
      "json",
      '{"results":[{"testCaseId":"TC-LOGIN-1","status":"Blocked","notes":"flaky"}]}',
    );

    expect(request).toEqual({
      format: "json",
      body: {
        results: [
          { testCaseId: "TC-LOGIN-1", status: "Blocked", notes: "flaky" },
        ],
      },
    });
  });

  it("refuses a file that is not JSON without reaching the API", () => {
    expect(() => buildImportRequest("json", "<testsuite />")).toThrow(
      ImportFileError,
    );
    expect(() => buildImportRequest("json", "")).toThrow(
      "The file is not valid JSON.",
    );
  });

  it("posts a JUnit report verbatim", () => {
    const report =
      '<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="smoke">\n  <testcase name="TC-LOGIN-1 &amp; co" />\n</testsuite>\n';

    expect(buildImportRequest("junit", report)).toEqual({
      format: "junit",
      body: report,
    });
  });
});

describe("describeImportSummary", () => {
  it("reports the counts an import wrote", () => {
    expect(describeImportSummary(SUMMARY)).toBe(
      "Imported 3 results: 2 passed, 1 failed, 0 blocked.",
    );
  });

  it("counts the cases left unwritten when the import skipped any", () => {
    expect(
      describeImportSummary({
        ...SUMMARY,
        imported: 1,
        skipped: 3,
        duplicates: 2,
        errors: 1,
        summary: { passed: 1, failed: 0, blocked: 0 },
      }),
    ).toBe(
      "Imported 1 result: 1 passed, 0 failed, 0 blocked. Skipped 3: 2 already recorded, 1 unusable.",
    );
  });
});
