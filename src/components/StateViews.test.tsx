import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingSkeleton } from "./StateViews.js";
import { ClipboardIcon } from "./Icon.js";

describe("EmptyState", () => {
  it("shows the message and an optional action", () => {
    render(
      <EmptyState
        icon={<ClipboardIcon />}
        message="No test cases found"
        action={
          <button className="btn btn-primary" onClick={() => {}}>
            + Create
          </button>
        }
      />,
    );
    expect(screen.getByText("No test cases found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Create" })).toBeInTheDocument();
    // The icon is decoration, never an announcement: the SVG is hidden and
    // the message text carries the meaning (#180).
    const icon = document.querySelector(".state-view__icon svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LoadingSkeleton", () => {
  it("renders the requested grid and announces loading", () => {
    const { container } = render(<LoadingSkeleton rows={3} columns={4} />);
    expect(container.querySelectorAll(".skeleton-row")).toHaveLength(3);
    expect(container.querySelectorAll(".skeleton-cell")).toHaveLength(12);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-label", "Loading");
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("states the message, the code, and retries on demand", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        code="not_found"
        message="project not found"
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("project not found");
    expect(screen.getByText("Error code: not_found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("omits the code line and the retry button when there is none", () => {
    render(<ErrorState code={null} message="generic failure" />);
    expect(screen.queryByText(/Error code/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
