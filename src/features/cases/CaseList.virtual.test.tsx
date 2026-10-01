import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { TestCase } from "../../api/generated/index.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider } from "../../app/ProjectContext.js";
import { jsonResponse, mockApi, resetTestApi } from "../../test-utils.js";
import { CaseList } from "./CaseList.js";

/**
 * Performance at scale (#173): a five-thousand-case project must render a
 * bounded DOM, and its filtering must stay inside the budget #122 promised.
 * The bound asserted under jsdom is deliberately generous — CI runners are
 * slower than browsers — the point is the ceiling holds, not the browser's
 * real number.
 */
const TOTAL = 5000;

function bigProject(): Record<string, unknown> {
  const cases: TestCase[] = Array.from({ length: TOTAL }, (_, i) => ({
    testCaseId: `TC-BULK-${String(i).padStart(5, "0")}`,
    title: `Bulk case ${i}`,
    expectedResult: "Nothing",
    version: 1,
    lastModified: "2026-09-17T10:00:00Z",
  }));
  return {
    projectId: "bulk",
    name: "Bulk",
    testCases: cases,
    testSuites: [],
  };
}

function renderList() {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <CaseList
          projectId="bulk"
          suiteFilter={null}
          selectedCaseId={null}
          onSelectCase={() => {}}
          onCreateRun={() => {}}
        />
      </ProjectProvider>
    </AuthProvider>,
  );
}

afterEach(() => {
  resetTestApi();
});

describe("CaseList at scale", () => {
  it("windows the DOM and keeps the scroll model intact", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/bulk" && method === "GET") {
        return jsonResponse(200, bigProject());
      }
      if (url === "/api/reports/last-results?projectId=bulk" && method === "GET") {
        return jsonResponse(200, { projectId: "bulk", cases: [] });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const started = performance.now();
    renderList();
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Test cases, scrollable" }),
      ).toBeInTheDocument(),
    );
    const mounted = performance.now() - started;

    // Five thousand model rows; a window of them in the DOM. The header, the
    // overscan and the two spacer rows are all that render.
    expect(screen.getAllByRole("row").length).toBeLessThan(100);

    // The bulk selection and the export operate on the model, not the window.
    fireEvent.click(screen.getByLabelText("Select all"));
    expect(screen.getByText(`${TOTAL} selected`)).toBeInTheDocument();

    // The filter stays inside budget even measured through jsdom's slowest
    // possible renderer; the window recomputes, not the table rebuild.
    const search = screen.getByRole("searchbox", { name: "Search cases" });
    const startedFilter = performance.now();
    fireEvent.change(search, { target: { value: "0042" } });
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(12));
    const filtered = performance.now() - startedFilter;
    expect(filtered).toBeLessThan(2000);
    expect(mounted).toBeLessThan(10_000);
  });
});
