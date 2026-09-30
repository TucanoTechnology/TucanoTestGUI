import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { jsonResponse, mockApi, resetTestApi } from "../../test-utils.js";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider } from "../../app/ProjectContext.js";
import { MilestoneList } from "./MilestoneList.js";

const MILESTONE = {
  milestoneId: "v1.0.json",
  name: "v1.0",
  status: "in_progress",
};

const PROGRESS = {
  totalCases: 4,
  passed: 2,
  failed: 1,
  blocked: 0,
  untested: 1,
  retest: 0,
  passPercentage: 50,
};

function renderList(onSelect: (id: string) => void = () => {}) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <MilestoneList
          projectId="checkout"
          selectedMilestoneId={null}
          onSelectMilestone={onSelect}
        />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function mockMilestonesApi(progressFails = false) {
  const requests = mockApi(({ url, method }) => {
    if (url === "/api/projects/checkout/milestones" && method === "GET") {
      return jsonResponse(200, ["v1.0.json"]);
    }
    if (url === "/api/milestones/v1.0.json" && method === "GET") {
      return jsonResponse(200, MILESTONE);
    }
    if (url === "/api/milestones/v1.0.json/progress" && method === "GET") {
      if (progressFails) {
        return jsonResponse(500, {
          error: { code: "internal", message: "progress failed" },
        });
      }
      return jsonResponse(200, PROGRESS);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  return { requests };
}

afterEach(() => {
  resetTestApi();
});

describe("MilestoneList", () => {
  it("lists milestones with a five-segment progress bar", async () => {
    mockMilestonesApi();
    renderList();

    await waitFor(() =>
      expect(screen.getAllByRole("row")).toHaveLength(2),
    );
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    // The listing key is shown next to the name.
    expect(screen.getByText("v1.0.json")).toBeInTheDocument();
    expect(screen.getByText("in_progress")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Passed: 2, Failed: 1, Blocked: 0, Untested: 1, Retest: 0",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the row when the progress route fails", async () => {
    mockMilestonesApi(true);
    renderList();

    await waitFor(() =>
      expect(screen.getAllByRole("row")).toHaveLength(2),
    );
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    // The cell carries a dash rather than a bar: a failed count is not zero.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("selects a milestone from its row", async () => {
    mockMilestonesApi();
    const picked: string[] = [];
    renderList((id) => picked.push(id));

    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));
    fireEvent.click(screen.getByText("v1.0"));
    expect(picked).toEqual(["v1.0.json"]);
  });

  it("filters the rows from the search input", async () => {
    mockMilestonesApi();
    renderList();
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2));

    fireEvent.change(screen.getByLabelText("Search milestones"), {
      target: { value: "nope" },
    });
    expect(
      screen.getByText("No milestones match the search"),
    ).toBeInTheDocument();
  });
});
