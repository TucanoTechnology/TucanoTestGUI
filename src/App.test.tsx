import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { App } from "./App.js";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("App", () => {
  it("renders the login screen when not authenticated", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Tucano Test" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("login form has a submit button", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("login screen is accessible", async () => {
    const { default: axe } = await import("axe-core");
    const { container } = render(<App />);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
