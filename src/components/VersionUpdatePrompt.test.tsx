import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "../test/test-utils";
import { VersionUpdatePrompt } from "./VersionUpdatePrompt";

const mockRefreshApp = vi.fn();
const mockDismissPrompt = vi.fn();
let mockShowRefreshPrompt = true;

vi.mock("../hooks/useVersionCheck", () => ({
  useVersionCheck: () => ({
    get showRefreshPrompt() {
      return mockShowRefreshPrompt;
    },
    refreshApp: mockRefreshApp,
    dismissPrompt: mockDismissPrompt,
  }),
}));

describe("VersionUpdatePrompt", () => {
  beforeEach(() => {
    mockShowRefreshPrompt = true;
    vi.clearAllMocks();
  });

  it("renders update prompt when showRefreshPrompt is true", () => {
    render(<VersionUpdatePrompt />);

    expect(screen.getByText(/app updated/i)).toBeInTheDocument();
    expect(
      screen.getByText(/a new version is available/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Refresh Now")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("calls refreshApp when Refresh Now is clicked", () => {
    render(<VersionUpdatePrompt />);

    fireEvent.click(screen.getByText("Refresh Now"));
    expect(mockRefreshApp).toHaveBeenCalled();
  });

  it("calls dismissPrompt when Later is clicked", () => {
    render(<VersionUpdatePrompt />);

    fireEvent.click(screen.getByText("Later"));
    expect(mockDismissPrompt).toHaveBeenCalled();
  });

  it("renders nothing when showRefreshPrompt is false", () => {
    mockShowRefreshPrompt = false;

    const { container } = render(<VersionUpdatePrompt />);
    expect(container.innerHTML).toBe("");
  });
});
