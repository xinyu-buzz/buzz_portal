import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../test/test-utils";
import { Layout } from "./index";

// Mock the child components
vi.mock("../menu", () => ({
  Menu: () => <nav data-testid="menu">Menu</nav>,
}));

vi.mock("../breadcrumb", () => ({
  Breadcrumb: () => <div data-testid="breadcrumb">Breadcrumb</div>,
}));

describe("Layout", () => {
  it("renders children", () => {
    render(
      <Layout>
        <div>Page Content</div>
      </Layout>
    );

    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("renders Menu component", () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByTestId("menu")).toBeInTheDocument();
  });

  it("renders Breadcrumb component", () => {
    render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
  });

  it("has layout class on root element", () => {
    const { container } = render(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(container.querySelector(".layout")).toBeInTheDocument();
  });
});
