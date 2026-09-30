import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { jsonResponse, mockApi, resetTestApi } from "../test-utils.js";
import { AuthProvider } from "./AuthProvider.js";
import { ProjectProvider } from "./ProjectContext.js";
import { GlobalSearch } from "./GlobalSearch.js";

const PROJECT = {
  projectId: "checkout",
  name: "Checkout",
  testSuites: [
    {
      suiteId: "smoke",
      name: "Smoke",
      testCases: [{ testCaseId: "TC-CART-1", title: "Add to cart" }],
    },
  ],
  testCases: [{ testCaseId: "TC-DIRECT-1", title: "Open the page" }],
};

function renderSearch(onPick: (hit: unknown) => void = () => {}) {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <GlobalSearch onPick={onPick} />
      </ProjectProvider>
    </AuthProvider>,
  );
}

function mockIndexApi() {
  const requests = mockApi(({ url, method }) => {
    if (url === "/api/projects" && method === "GET") {
      return jsonResponse(200, ["checkout"]);
    }
    if (url === "/api/projects/checkout" && method === "GET") {
      return jsonResponse(200, PROJECT);
    }
    if (url.startsWith("/api/projects/checkout/") && method === "GET") {
      return jsonResponse(200, []);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  return { requests };
}

afterEach(() => {
  resetTestApi();
});

describe("GlobalSearch", () => {
  it("waits for two characters before it reads anything", async () => {
    const { requests } = mockIndexApi();
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "ca" },
    });

    await screen.findByText("Add to cart");
    // One read per project answers the whole index; a second keystroke costs
    // nothing beyond the first build.
    const projectReads = () =>
      requests.filter((request) => request.url === "/api/projects").length;
    const reads = projectReads();
    expect(reads).toBe(1);

    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "cart" },
    });
    await waitFor(() => {
      expect(screen.getByText("Add to cart")).toBeInTheDocument();
    });
    expect(projectReads()).toBe(reads);
  });

  it("states the type, the name and the id of each hit", async () => {
    mockIndexApi();
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "tc-" },
    });

    const hit = await screen.findByRole("button", {
      name: "case Add to cart (TC-CART-1)",
    });
    expect(hit).toBeInTheDocument();
    // A single-character query never reaches the API.
    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "c" },
    });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("reports hits for entities addressed only by their key", async () => {
    mockIndexApi();
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "Open" },
    });
    expect(
      await screen.findByRole("button", {
        name: "case Open the page (TC-DIRECT-1)",
      }),
    ).toBeInTheDocument();
  });

  it("reports no matches without a request storm", async () => {
    mockIndexApi();
    renderSearch();

    fireEvent.change(screen.getByRole("searchbox", { name: "Global search" }), {
      target: { value: "zzzz" },
    });
    expect(
      await screen.findByText(/No matches for/),
    ).toBeInTheDocument();
  });
});
