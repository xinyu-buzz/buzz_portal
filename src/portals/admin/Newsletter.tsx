import type { FC } from "react";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type SendStatus = "idle" | "sending" | "success" | "error";

type Subscriber = {
  id: string;
  email: string;
  subscribed_at: string;
  status: string;
};

export const Newsletter: FC = () => {
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);

  useEffect(() => {
    const loadSubscriberCount = async () => {
      const { count, error } = await supabaseClient
        .from("newsletter_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      if (error) {
        console.error("Failed to load subscriber count", error);
      } else {
        setSubscriberCount(count ?? 0);
      }
    };

    loadSubscriberCount();
  }, []);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setErrorMessage("Please fill in both subject and body.");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);

    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "send-newsletter",
        {
          body: { subject: subject.trim(), body: body.trim() },
        }
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus("success");
      setSuccessCount(data?.sent ?? subscriberCount ?? 0);
      setSubject("");
      setBody("");
    } catch (err: any) {
      console.error("Failed to send newsletter", err);
      setStatus("error");
      setErrorMessage(err?.message || "Failed to send newsletter. Please try again.");
    }
  };

  const resetForm = () => {
    setStatus("idle");
    setErrorMessage(null);
    setSuccessCount(0);
  };

  const loadSubscribers = async () => {
    setLoadingSubscribers(true);
    const { data, error } = await supabaseClient
      .from("newsletter_subscriptions")
      .select("id, email, subscribed_at, status")
      .order("subscribed_at", { ascending: false });

    if (error) {
      console.error("Failed to load subscribers", error);
    } else {
      setSubscribers(data || []);
    }
    setLoadingSubscribers(false);
  };

  const handleShowSubscribers = () => {
    setShowSubscribersModal(true);
    loadSubscribers();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="page-header">
          <div>
            <h1>Newsletter</h1>
            <p className="muted-text">
              {subscriberCount !== null
                ? `${subscriberCount} active subscriber${subscriberCount !== 1 ? "s" : ""}`
                : "Loading subscribers..."}
            </p>
          </div>
          <button className="primary-btn" onClick={handleShowSubscribers}>
            See Subscribers
          </button>
        </div>

        {status === "success" ? (
          <div className="newsletter-success">
            <div className="success-icon">✓</div>
            <h2>Newsletter Sent!</h2>
            <p className="muted-text">
              Successfully sent to {successCount} subscriber{successCount !== 1 ? "s" : ""}.
            </p>
            <button className="primary-btn" onClick={resetForm}>
              Send Another
            </button>
          </div>
        ) : (
          <div className="newsletter-form">
            {errorMessage && (
              <div className="alert error">{errorMessage}</div>
            )}

            <div className="form-group">
              <label className="input-label" htmlFor="subject">
                Subject
              </label>
              <input
                id="subject"
                type="text"
                className="text-input"
                placeholder="Enter newsletter subject..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={status === "sending"}
              />
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="body">
                Body
              </label>
              <textarea
                id="body"
                className="text-input newsletter-body"
                placeholder="Write your newsletter content here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={status === "sending"}
                rows={12}
              />
            </div>

            <div className="newsletter-actions">
              <button
                className="primary-btn"
                onClick={handleSend}
                disabled={status === "sending" || !subject.trim() || !body.trim()}
              >
                {status === "sending" ? "Sending..." : "Send to All"}
              </button>
            </div>
          </div>
        )}
      </div>

      {showSubscribersModal && (
        <div className="modal-backdrop" onClick={() => setShowSubscribersModal(false)} onKeyDown={(e) => { if (e.key === "Escape") setShowSubscribersModal(false); }}>
          <div className="modal-card subscribers-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Newsletter Subscribers</h2>
              <button
                className="modal-close"
                onClick={() => setShowSubscribersModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loadingSubscribers ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                Loading subscribers...
              </div>
            ) : subscribers.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)" }}>
                No subscribers yet.
              </div>
            ) : (
              <div className="modal-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Subscribed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id}>
                        <td>{subscriber.email}</td>
                        <td>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              textTransform: "capitalize",
                              background: subscriber.status === "active" ? "#4a7c59" : "#6c5a4a",
                              color: "#fff",
                            }}
                          >
                            {subscriber.status}
                          </span>
                        </td>
                        <td>{formatDate(subscriber.subscribed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .newsletter-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .newsletter-body {
          resize: vertical;
          min-height: 200px;
          font-family: inherit;
          line-height: 1.5;
        }

        .newsletter-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }

        .newsletter-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #4a7c59;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          margin-bottom: 16px;
        }

        .newsletter-success h2 {
          margin: 0 0 8px 0;
        }

        .newsletter-success .muted-text {
          margin: 0 0 24px 0;
        }

        .subscribers-modal {
          max-width: 800px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
        }

        .modal-close {
          background: transparent;
          border: none;
          font-size: 32px;
          color: var(--muted);
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: background 120ms ease, color 120ms ease;
        }

        .modal-close:hover {
          background: var(--border);
          color: var(--text);
        }

        .modal-body {
          overflow-y: auto;
          flex: 1;
        }

        .subscribers-modal .data-table {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
};
