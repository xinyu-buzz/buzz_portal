import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { render } from "../../test/test-utils";
import { AdminInbox } from "./AdminInbox";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("../../utility", () => ({
  supabaseClient: {
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  },
}));

const notifications = [
  {
    id: "n1",
    title: "New bug report",
    body: 'Maverick submitted "Login issue".',
    source_type: "bug_report",
    link_path: "/admin/tickets",
    is_read: false,
    created_at: "2026-03-13T12:00:00.000Z",
    email_status: "sent",
  },
  {
    id: "n2",
    title: "New express promotion application",
    body: "Goose submitted a commander promotion request.",
    source_type: "express_promotion",
    link_path: "/admin/express-promotions",
    is_read: true,
    created_at: "2026-03-12T12:00:00.000Z",
    email_status: "pending",
  },
];

const createSelectBuilder = (rows = notifications) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: rows, error: null }),
});

const createUpdateBuilder = () => ({
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockResolvedValue({ data: null, error: null }),
});

describe("AdminInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email: "admin@buzzbuzzin.com",
        },
      },
      error: null,
    });
  });

  it("shows the bell with the unread count", async () => {
    mockFrom.mockReturnValueOnce(createSelectBuilder());

    render(<AdminInbox />, { initialEntries: ["/admin/dashboard"] });

    expect(
      await screen.findByRole("button", { name: "Inbox with 1 unread item" })
    ).toBeInTheDocument();
  });

  it("opens the inbox window when the bell is clicked", async () => {
    const user = userEvent.setup();
    mockFrom
      .mockReturnValueOnce(createSelectBuilder())
      .mockReturnValueOnce(createSelectBuilder());

    render(<AdminInbox />, { initialEntries: ["/admin/dashboard"] });

    await screen.findByRole("button", { name: "Inbox with 1 unread item" });
    await user.click(screen.getByRole("button", { name: "Inbox with 1 unread item" }));

    expect(await screen.findByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("New bug report")).toBeInTheDocument();
    expect(screen.getByText("New express promotion application")).toBeInTheDocument();
  });

  it("marks a notification as read", async () => {
    const user = userEvent.setup();
    const updateBuilder = createUpdateBuilder();

    mockFrom
      .mockReturnValueOnce(createSelectBuilder())
      .mockReturnValueOnce(createSelectBuilder())
      .mockReturnValueOnce(updateBuilder);

    render(<AdminInbox />, { initialEntries: ["/admin/dashboard"] });

    await screen.findByRole("button", { name: "Inbox with 1 unread item" });
    await user.click(screen.getByRole("button", { name: "Inbox with 1 unread item" }));
    await screen.findByText("New bug report");
    await user.click(screen.getByRole("button", { name: "Mark Read" }));

    await waitFor(() => {
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true })
      );
      expect(screen.queryByText("Mark Read")).not.toBeInTheDocument();
    });
  });
});
