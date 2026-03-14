import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseClient } from "../../utility";

type AdminInboxNotification = {
  id: string;
  title: string;
  body: string;
  source_type: string;
  link_path: string;
  is_read: boolean;
  created_at: string;
  email_status: "pending" | "sent" | "failed";
};

const REFRESH_INTERVAL_MS = 30_000;

const SOURCE_LABELS: Record<string, string> = {
  bug_report: "Bug Report",
  safety_report: "Safety Report",
  express_promotion: "Express Promotion",
  flight_reviewer_application: "Flight Reviewer",
  roc_a_examiner_application: "ROC-A Examiner",
  flight_hour_claim: "Flight Hour Claim",
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const AdminInbox = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminInboxNotification[]>([]);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadNotifications = async () => {
    setError(null);

    try {
      const { data } = await supabaseClient.auth.getUser();
      const email = data?.user?.email?.trim().toLowerCase() || null;

      setRecipientEmail(email);

      if (!email) {
        setNotifications([]);
        return;
      }

      const { data: rows, error } = await supabaseClient
        .from("admin_inbox_notifications")
        .select("id, title, body, source_type, link_path, is_read, created_at, email_status")
        .eq("recipient_email", email)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load admin inbox notifications", error);
        setError("Unable to load inbox items. Please try again.");
        return;
      }

      setNotifications(
        [...((rows || []) as AdminInboxNotification[])].sort((left, right) => {
          if (left.is_read !== right.is_read) {
            return left.is_read ? 1 : -1;
          }
          return (
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
          );
        })
      );
    } catch (error) {
      console.error("Failed to resolve inbox recipient", error);
      setError("Unable to load inbox items. Please try again.");
    }
  };

  const refreshNotifications = async () => {
    setLoading(true);
    await loadNotifications();
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      if (!active) return;
      await refreshNotifications();
    };

    void refresh();
    const intervalId = window.setInterval(() => {
      if (!active) return;
      void loadNotifications();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const recentNotifications = useMemo(() => notifications.slice(0, 8), [notifications]);

  const markAsRead = async (ids: string[]) => {
    if (ids.length === 0 || !recipientEmail) return;

    setSaving(true);
    setError(null);

    try {
      const { error } = await supabaseClient
        .from("admin_inbox_notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("recipient_email", recipientEmail)
        .in("id", ids);

      if (error) {
        console.error("Failed to mark admin inbox notifications as read", error);
        setError("Unable to update inbox items. Please try again.");
        return;
      }

      setNotifications((current) =>
        current.map((notification) =>
          ids.includes(notification.id)
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllVisibleRead = async () => {
    await markAsRead(
      recentNotifications
        .filter((notification) => !notification.is_read)
        .map((notification) => notification.id)
    );
  };

  const handleOpenNotification = async (notification: AdminInboxNotification) => {
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    setOpen(false);
    navigate(notification.link_path);
  };

  return (
    <div className="nav-inbox" ref={wrapperRef}>
      <button
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Inbox with ${unreadCount} unread item${unreadCount === 1 ? '' : 's'}` : "Inbox"}
        className="nav-inbox__button"
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            void refreshNotifications();
          }
        }}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="nav-inbox__badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="nav-inbox__panel">
          <div className="nav-inbox__header">
            <div>
              <h2>Inbox</h2>
              <p>{unreadCount} unread</p>
            </div>
            <button
              className="ghost-btn"
              onClick={() => void refreshNotifications()}
              disabled={loading}
              type="button"
            >
              Refresh
            </button>
          </div>

          {error && <div className="alert error">{error}</div>}

          {loading ? (
            <p className="muted-text">Loading inbox...</p>
          ) : recentNotifications.length === 0 ? (
            <p className="muted-text">No inbox items yet.</p>
          ) : (
            <div className="nav-inbox__list">
              {recentNotifications.map((notification) => (
                <section
                  key={notification.id}
                  className={`nav-inbox__item${notification.is_read ? "" : " nav-inbox__item--new"}`}
                >
                  <div className="nav-inbox__meta">
                    <span>{SOURCE_LABELS[notification.source_type] || "Admin Item"}</span>
                    <span>{formatTimestamp(notification.created_at)}</span>
                  </div>

                  <div className="nav-inbox__item-header">
                    <h3>{notification.title}</h3>
                    {!notification.is_read && <span className="nav-inbox__pill">New</span>}
                  </div>

                  <p>{notification.body}</p>

                  <div className="nav-inbox__actions">
                    <button
                      className="primary-btn"
                      onClick={() => void handleOpenNotification(notification)}
                      type="button"
                    >
                      Open
                    </button>
                    {!notification.is_read && (
                      <button
                        className="ghost-btn"
                        onClick={() => void markAsRead([notification.id])}
                        disabled={saving}
                        type="button"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div className="nav-inbox__footer">
            <span className="muted-text">Showing the 8 most recent items</span>
            <button
              className="ghost-btn"
              onClick={() => void handleMarkAllVisibleRead()}
              disabled={
                saving ||
                recentNotifications.filter((notification) => !notification.is_read).length === 0
              }
              type="button"
            >
              Mark All Read
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
