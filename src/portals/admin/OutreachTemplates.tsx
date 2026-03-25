import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type Template = {
  id: string;
  name: string;
  channel: string;
  subject_template: string | null;
  body_template: string;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

type TemplateForm = {
  name: string;
  channel: string;
  subject_template: string;
  body_template: string;
  is_active: boolean;
};

const CHANNELS = ["email", "instagram_dm", "linkedin_dm", "facebook_dm"] as const;

const CHANNEL_COLORS: Record<string, { bg: string; color: string }> = {
  email: { bg: "#2a5a9a", color: "#fff" },
  instagram_dm: { bg: "#a13d7e", color: "#fff" },
  linkedin_dm: { bg: "#4a6a7a", color: "#fff" },
  facebook_dm: { bg: "#3b5998", color: "#fff" },
};

const VARIABLES = [
  "{{first_name}}",
  "{{last_name}}",
  "{{city}}",
  "{{state}}",
  "{{business_name}}",
  "{{specialization_list}}",
  "{{experience_level}}",
];

const emptyForm: TemplateForm = {
  name: "",
  channel: "email",
  subject_template: "",
  body_template: "",
  is_active: true,
};

export const OutreachTemplates: FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabaseClient
      .from("outreach_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load templates", error);
    } else {
      setTemplates(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage(null);
    setShowModal(true);
  };

  const openEdit = (template: Template) => {
    setEditingId(template.id);
    setForm({
      name: template.name,
      channel: template.channel,
      subject_template: template.subject_template || "",
      body_template: template.body_template,
      is_active: template.is_active,
    });
    setErrorMessage(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body_template.trim()) {
      setErrorMessage("Name and body template are required.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);

    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const payload = {
        name: form.name.trim(),
        channel: form.channel,
        subject_template: form.channel === "email" ? form.subject_template.trim() || null : null,
        body_template: form.body_template.trim(),
        is_active: form.is_active,
      };

      if (editingId) {
        const { error } = await supabaseClient
          .from("outreach_templates")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("outreach_templates")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }

      setShowModal(false);
      loadTemplates();
    } catch (err: any) {
      console.error("Failed to save template", err);
      setErrorMessage(err?.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabaseClient
        .from("outreach_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setDeleteConfirmId(null);
      loadTemplates();
    } catch (err: any) {
      console.error("Failed to delete template", err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const channelBadge = (channel: string) => {
    const style = CHANNEL_COLORS[channel] || { bg: "#555", color: "#fff" };
    return (
      <span
        style={{
          display: "inline-block",
          padding: "4px 8px",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: "600",
          textTransform: "capitalize",
          background: style.bg,
          color: style.color,
        }}
      >
        {channel.replace(/_/g, " ")}
      </span>
    );
  };

  const activeBadge = (active: boolean) => (
    <span
      style={{
        display: "inline-block",
        padding: "4px 8px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "600",
        background: active ? "#4a7c59" : "#6c5a4a",
        color: "#fff",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );

  return (
    <div className="page-shell">
      <div className="page-card">
        <div className="page-header">
          <div>
            <h1>Outreach Templates</h1>
            <p className="muted-text">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="primary-btn" onClick={openCreate}>
            New Template
          </button>
        </div>

        {loading ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            Loading templates...
          </p>
        ) : templates.length === 0 ? (
          <p className="muted-text" style={{ textAlign: "center", padding: "48px 0" }}>
            No templates yet. Create one to get started.
          </p>
        ) : (
          <table className="data-table" style={{ marginTop: "20px" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Channel</th>
                <th>Active</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>{channelBadge(t.channel)}</td>
                  <td>{activeBadge(t.is_active)}</td>
                  <td>{formatDate(t.created_at)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="ghost-btn" onClick={() => openEdit(t)}>
                        Edit
                      </button>
                      {deleteConfirmId === t.id ? (
                        <>
                          <button
                            className="ghost-btn"
                            style={{ color: "#e05050" }}
                            onClick={() => handleDelete(t.id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="ghost-btn"
                            onClick={() => setDeleteConfirmId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="ghost-btn"
                          style={{ color: "#e05050" }}
                          onClick={() => setDeleteConfirmId(t.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowModal(false);
          }}
        >
          <div
            className="modal-card template-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editingId ? "Edit Template" : "New Template"}</h2>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {errorMessage && (
              <div className="alert error" style={{ marginBottom: "16px" }}>
                {errorMessage}
              </div>
            )}

            <div className="template-form">
              <div className="form-group">
                <label className="input-label" htmlFor="tmpl-name">
                  Name
                </label>
                <input
                  id="tmpl-name"
                  type="text"
                  className="text-input"
                  placeholder="e.g. Welcome Email"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="input-label" htmlFor="tmpl-channel">
                  Channel
                </label>
                <select
                  id="tmpl-channel"
                  className="text-input"
                  value={form.channel}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, channel: e.target.value }))
                  }
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {form.channel === "email" && (
                <div className="form-group">
                  <label className="input-label" htmlFor="tmpl-subject">
                    Subject Template
                  </label>
                  <input
                    id="tmpl-subject"
                    type="text"
                    className="text-input"
                    placeholder="e.g. Hey {{first_name}}, flying near {{city}}?"
                    value={form.subject_template}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        subject_template: e.target.value,
                      }))
                    }
                  />
                </div>
              )}

              <div className="form-group">
                <label className="input-label" htmlFor="tmpl-body">
                  Body Template
                </label>
                <textarea
                  id="tmpl-body"
                  className="text-input"
                  placeholder="Write your message template here..."
                  value={form.body_template}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, body_template: e.target.value }))
                  }
                  rows={10}
                  style={{ resize: "vertical", minHeight: "160px", fontFamily: "inherit" }}
                />
              </div>

              <div className="variables-panel">
                <p
                  className="muted-text"
                  style={{ fontSize: "12px", marginBottom: "6px", fontWeight: 600 }}
                >
                  Available Variables
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {VARIABLES.map((v) => (
                    <code key={v} className="variable-tag">
                      {v}
                    </code>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <input
                  id="tmpl-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                <label className="input-label" htmlFor="tmpl-active" style={{ margin: 0 }}>
                  Active
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                <button className="ghost-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  className="primary-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .template-modal {
          max-width: 680px;
          max-height: 90vh;
          overflow-y: auto;
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

        .template-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .template-form select {
          appearance: auto;
        }

        .variables-panel {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }

        .variable-tag {
          background: rgba(255, 165, 0, 0.15);
          color: var(--accent);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};
