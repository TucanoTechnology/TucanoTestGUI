import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "../../app/AuthProvider.js";
import { ProjectProvider, useProjectContext } from "../../app/ProjectContext.js";
import {
  errorEnvelope,
  jsonResponse,
  mockApi,
  resetTestApi,
} from "../../test-utils.js";
import { ProjectDetail } from "./ProjectDetail.js";

const CHECKOUT = {
  projectId: "checkout",
  name: "Checkout",
  description: "Payment flow",
  tags: ["web", "smoke"],
};

function Harness({ projectId }: { projectId: string }) {
  const { selection, setSelection, announcement } = useProjectContext();

  useEffect(() => {
    setSelection({ type: "project", id: projectId });
  }, [projectId, setSelection]);

  return (
    <nav aria-label="Context probe">
      <span data-testid="announcement">{announcement?.message ?? ""}</span>
      <span data-testid="selection">
        {selection ? `${selection.type}:${selection.id}` : "none"}
      </span>
      {selection?.type === "project" && (
        <ProjectDetail projectId={selection.id} />
      )}
    </nav>
  );
}

function renderDetail() {
  return render(
    <AuthProvider>
      <ProjectProvider>
        <Harness projectId="checkout" />
      </ProjectProvider>
    </AuthProvider>,
  );
}

async function openDetail() {
  const view = renderDetail();
  await screen.findByRole("heading", { name: "Checkout" });
  return view;
}

afterEach(() => {
  resetTestApi();
});

describe("ProjectDetail", () => {
  it("sends only the changed fields when editing a project", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout" && method === "PUT") {
        return jsonResponse(200, { message: "Project updated" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    // The project's key is already fixed, so this name is not an identifier and
    // the form says nothing about one being derived from it.
    expect(within(form).queryByText(/with .json appended/)).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Name"), {
      target: { value: "Checkout v2" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });

    const puts = requests.filter((request) => request.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0]?.url).toBe("/api/projects/checkout");
    expect(puts[0]?.body).toEqual({ name: "Checkout v2" });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Project updated",
    );
  });

  it("closes the edit form without a request when nothing changed", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const form = await screen.findByRole("form", { name: "Save changes form" });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
    expect(requests.filter((request) => request.method !== "GET")).toHaveLength(
      0,
    );
  });

  it("deletes a project after confirmation and clears the selection", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout" && method === "DELETE") {
        return jsonResponse(200, { message: "Project deleted" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Delete project",
    });
    expect(dialog).toHaveTextContent("Checkout");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete project" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe("none");
    });

    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]?.url).toBe("/api/projects/checkout");
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Project deleted",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("duplicates a project under a new id and name and selects the copy", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout/duplicate" && method === "POST") {
        return jsonResponse(201, { message: "Project duplicated", id: "copy" });
      }
      if (url === "/api/projects/copy" && method === "GET") {
        return jsonResponse(200, { ...CHECKOUT, projectId: "copy" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate project",
    });
    const form = within(dialog).getByRole("form", {
      name: "Duplicate project form",
    });
    fireEvent.change(within(form).getByLabelText("New ID (optional)"), {
      target: { value: "copy" },
    });
    fireEvent.change(within(form).getByLabelText("New name (optional)"), {
      target: { value: "Checkout copy" },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByTestId("selection").textContent).toBe("project:copy");
    });

    const posts = requests.filter((request) => request.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toBe("/api/projects/checkout/duplicate");
    expect(posts[0]?.body).toEqual({
      newId: "copy.json",
      newName: "Checkout copy",
    });
    expect(screen.getByTestId("announcement")).toHaveTextContent(
      "Project duplicated",
    );
  });

  it("states the .json rule and adds a missing suffix to a typed id", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Project duplicated",
          id: "audit-sweep-copy.json",
        });
      }
      if (url === "/api/projects/audit-sweep-copy.json" && method === "GET") {
        return jsonResponse(200, { ...CHECKOUT, projectId: "audit-sweep-copy.json" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate project",
    });
    const idField = within(dialog).getByLabelText("New ID (optional)");
    // The rule the API enforces is stated, so the field does not read as
    // "type any name".
    expect(idField).toHaveAccessibleDescription(/ending in \.json/);

    // A bare name is completed before it is sent, so it cannot be refused with
    // an opaque `Invalid request`.
    fireEvent.change(idField, { target: { value: "audit-sweep-copy" } });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate project form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({ newId: "audit-sweep-copy.json" });
  });

  it("leaves an id that already ends in .json alone", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Project duplicated",
          id: "copy.json",
        });
      }
      if (url === "/api/projects/copy.json" && method === "GET") {
        return jsonResponse(200, { ...CHECKOUT, projectId: "copy.json" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate project",
    });
    fireEvent.change(within(dialog).getByLabelText("New ID (optional)"), {
      target: { value: "  copy.json  " },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate project form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({ newId: "copy.json" });
  });

  it("omits both optional duplicate fields when they are left blank", async () => {
    const requests = mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout/duplicate" && method === "POST") {
        return jsonResponse(201, {
          message: "Project duplicated",
          id: "checkout-copy",
        });
      }
      if (url === "/api/projects/checkout-copy" && method === "GET") {
        return jsonResponse(200, { ...CHECKOUT, projectId: "checkout-copy" });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Duplicate project",
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "Duplicate project form" }),
    );

    await waitFor(() => {
      expect(
        requests.filter((request) => request.method === "POST"),
      ).toHaveLength(1);
    });
    const [post] = requests.filter((request) => request.method === "POST");
    expect(post?.body).toEqual({});
  });

  it("shows the API error envelope and keeps the dialog open when deletion is rejected", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      if (url === "/api/projects/checkout" && method === "DELETE") {
        return errorEnvelope(409, "conflict", "project still has test suites");
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Delete project",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete project" }),
    );

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("conflict");
    expect(alert).toHaveTextContent("project still has test suites");
    expect(
      screen.getByRole("dialog", { name: "Delete project" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations with the delete dialog open", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, CHECKOUT);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = await openDetail();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog", { name: "Delete project" });

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("lists the suites it carries and the cases it owns directly", async () => {
    mockApi(({ url, method }) => {
      if (url === "/api/projects/checkout" && method === "GET") {
        return jsonResponse(200, {
          ...CHECKOUT,
          testSuites: [
            {
              suiteId: "smoke.checkout",
              name: "Checkout smoke",
              testCases: [{ testCaseId: "TC-LOGIN-1", title: "Log in" }],
            },
          ],
          testCases: [
            {
              testCaseId: "TC-PROJECT-1",
              title: "Project level case",
              priority: "Low",
            },
          ],
        });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { baseElement } = await openDetail();

    expect(screen.getByText("Test Suites (1)")).toBeInTheDocument();
    expect(screen.getByText("Test Cases (1)")).toBeInTheDocument();

    const { default: axe } = await import("axe-core");
    const results = await axe.run(baseElement, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", { name: /^Project level case/ }),
    );
    expect(screen.getByTestId("selection")).toHaveTextContent(
      "case:TC-PROJECT-1",
    );
  });
});
