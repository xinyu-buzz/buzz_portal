import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../../test/test-utils";
import PdfViewer from "./PdfViewer";

describe("PdfViewer", () => {
  it("renders with default title when no title provided", () => {
    render(<PdfViewer url="https://example.com/doc.pdf" />);

    expect(screen.getByText("PDF Document")).toBeInTheDocument();
  });

  it("renders with provided title", () => {
    render(
      <PdfViewer url="https://example.com/doc.pdf" title="My Document" />
    );

    expect(screen.getByText("My Document")).toBeInTheDocument();
  });

  it("renders the Open PDF link with correct href", () => {
    render(<PdfViewer url="https://example.com/doc.pdf" />);

    const link = screen.getByText("Open PDF");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/doc.pdf");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows preview mode message", () => {
    render(<PdfViewer url="https://example.com/doc.pdf" />);

    expect(
      screen.getByText("PDF viewer not available in preview mode")
    ).toBeInTheDocument();
  });

  it("calls onLoad when Open PDF link is clicked", () => {
    const onLoad = vi.fn();
    render(
      <PdfViewer url="https://example.com/doc.pdf" onLoad={onLoad} />
    );

    fireEvent.click(screen.getByText("Open PDF"));
    expect(onLoad).toHaveBeenCalled();
  });
});
