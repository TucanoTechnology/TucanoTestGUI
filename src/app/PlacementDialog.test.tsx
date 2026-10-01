import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, mockApi, resetTestApi } from "../test-utils.js";
import { AuthProvider } from "./AuthProvider.js";
import { ProjectProvider, useProjectContext } from "./ProjectContext.js";
import { PlacementDialog, type PlacementTarget } from "./PlacementDialog.js";

/** A probe so announcements are readable from outside the providers. */
function Announcements() {
  const { announcement } = useProjectContext();
  return <span data-testid="announcement">{announcement?.message ?? ""}</span>;
}

function renderDialog(
  target: PlacementTarget,
  onClose = vi.fn(),
): { onClose: () => void; dialog: HTMLElement } {
  render(
    <AuthProvider>
      <ProjectProvider>
        <Announcements />
        <PlacementDialog target={target} onClose={onClose} />
      </ProjectProvider>
    </AuthProvider>,
  );
  return {
    onClose,
    dialog: screen.getByRole("dialog", {
      name: `Move or copy ${target.label}`,
    }),
  };
}

const CASE: PlacementTarget = {
  kind: "case",
  resourceId: "TC-CART-1",
  label: "TC-CART-1",
};
const SUITE: PlacementTarget = {
  kind: "suite",
  resourceId: "smoke.json",
  label: "smoke.json",
};

function placementApi() {
  const posts: { url: string; body: unknown }[] = [];
  mockApi(({ url, method, body }) => {
    if (url === "/api/projects" && method === "GET") {
      return jsonResponse(200, ["checkout.json", "payments.json"]);
    }
    if (url === "/api/projects/checkout.json/test_suites" && method === "GET") {
      return jsonResponse(200, ["smoke.json", "regress.json"]);
    }
    if (url === "/api/projects/payments.json/test_suites" && method === "GET") {
      return jsonResponse(200, []);
    }
    if (method === "POST") {
      posts.push({ url, body });
      return jsonResponse(201, { message: "Test case copied", id: "x" });
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  });
  return posts;
}

afterEach(() => {
  resetTestApi();
});

/** The projects listing is async: a select cannot carry a value whose option
 * has not rendered, so every test waits for the destination first. */
async function chooseProject(dialog: HTMLElement, project: string) {
  await waitFor(() => {
    expect(
      within(dialog).getByRole("option", { name: project }),
    ).toBeInTheDocument();
  });
  fireEvent.change(within(dialog).getByLabelText("Destination project"), {
    target: { value: project },
  });
}

describe("PlacementDialog (#181)", () => {
  it("copies a case into a suite of the chosen project, the API's default mode", async () => {
    const posts = placementApi();
    const { onClose, dialog } = renderDialog(CASE);

    await chooseProject(dialog, "checkout.json");
    const suiteSelect = within(dialog).getByLabelText("Destination suite");
    await waitFor(() => {
      expect(
        within(suiteSelect).getByRole("option", { name: "regress.json" }),
      ).toBeInTheDocument();
    });
    fireEvent.change(suiteSelect, { target: { value: "smoke.json" } });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Copy here" }),
    );

    await waitFor(() => {
      expect(posts).toEqual([
        {
          url: "/api/test_suites/smoke.json/test_cases",
          body: { testCaseId: "TC-CART-1", mode: "copy" },
        },
      ]);
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(
      await screen.findByTestId("announcement"),
    ).toHaveTextContent("TC-CART-1 copied to smoke.json.");
  });

  it("moves a case into a project's direct scope when no suite is chosen", async () => {
    const posts = placementApi();
    const { dialog } = renderDialog(CASE);

    await chooseProject(dialog, "checkout.json");
    fireEvent.click(within(dialog).getByLabelText(/Move — relocate it/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Move here" }));

    await waitFor(() => {
      expect(posts).toEqual([
        {
          url: "/api/projects/checkout.json/test_cases",
          body: { testCaseId: "TC-CART-1", mode: "move" },
        },
      ]);
    });
    // The direct scope is the suite select's own first option, stated as such.
    expect(
      within(dialog).queryByText(/preview/),
    ).not.toBeInTheDocument();
  });

  it("offers only a destination project for a suite", async () => {
    const posts = placementApi();
    const { dialog } = renderDialog(SUITE);

    expect(
      within(dialog).queryByLabelText("Destination suite"),
    ).not.toBeInTheDocument();
    await chooseProject(dialog, "payments.json");
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy here" }));

    await waitFor(() => {
      expect(posts).toEqual([
        {
          url: "/api/projects/payments.json/test_suites",
          body: { suiteId: "smoke.json", mode: "copy" },
        },
      ]);
    });
  });

  it("keeps the dialog open and names the refusal when the store says no", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects" && method === "GET") {
        return jsonResponse(200, ["checkout.json"]);
      }
      if (method === "POST") {
        return jsonResponse(409, {
          error: { code: "conflict", message: "already filed here" },
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    const { dialog } = renderDialog(CASE);

    await chooseProject(dialog, "checkout.json");
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy here" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("already filed here");
    expect(
      screen.queryByRole("dialog", { name: "Move or copy TC-CART-1" }),
    ).toBeInTheDocument();
  });
});
