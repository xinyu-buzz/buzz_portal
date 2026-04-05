import { useEffect, useState } from "react";
import { supabaseClient } from "../utility";

type MediaFile = {
  id: string;
  booking_id: string;
  role: string;
  uploaded_by: string | null;
  kind: string;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

type Props = {
  bookingId: string;
  uploaderRole?: "pilot" | "editor" | "system";
};

export const BookingMediaManager = ({
  bookingId,
  uploaderRole = "pilot",
}: Props) => {
  const [role, setRole] = useState<string | null>(null);
  const sanitizeFileName = (name: string) => {
    const cleaned = name
      .normalize("NFKD")
      .replace(/\s+/g, "-")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return cleaned || "upload";
  };

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploaders, setUploaders] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("raw");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // UI-only role for showing/hiding controls; Supabase RLS enforces actual authorization.
    setRole(localStorage.getItem("buzz_portal_role"));
  }, []);

  const refresh = async () => {
    setError(null);
    setLoading(true);
    const { data, error: queryError } = await supabaseClient
      .from("booking_media_files")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Failed to load media", queryError);
      setError("Could not load media files");
    } else {
      setFiles(data || []);
      const uploaderIds = Array.from(
        new Set((data || []).map((f) => f.uploaded_by).filter(Boolean))
      ) as string[];
      if (uploaderIds.length) {
        const { data: profiles, error: profilesError } = await supabaseClient
          .from("profiles")
          .select("id,email,first_name,last_name,call_sign")
          .in("id", uploaderIds);

        if (profilesError) {
          console.error("Failed to load uploaders", profilesError);
          setError("Could not load uploader info");
        } else {
          const map = (profiles || []).reduce<Record<string, string>>(
            (acc, profile) => {
              const name =
                (profile as any).call_sign ||
                [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                profile.email ||
                profile.id;
              acc[profile.id] = name;
              return acc;
            },
            {}
          );
          setUploaders(map);
          setError(null);
        }
      } else {
        setUploaders({});
        setError(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [bookingId]);

  const formatFileSize = (size?: number | null) => {
    if (!size || size <= 0) return "—";
    const mb = size / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = size / 1024;
    if (kb >= 1) return `${kb.toFixed(1)} KB`;
    return `${size} B`;
  };

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const safeName = sanitizeFileName(file.name);
    const path = `booking/${bookingId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from("booking-media")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error(uploadError);
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: userData,
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError) {
      setError(userError.message);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabaseClient
      .from("booking_media_files")
      .insert({
        booking_id: bookingId,
        uploaded_by: userData.user?.id,
        role: uploaderRole,
        kind,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      });

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      // Clean up the orphaned storage file since the DB record failed
      await supabaseClient.storage.from("booking-media").remove([path]);
    } else {
      await refresh();
    }

    setUploading(false);
  };

  const handleDownload = async (storagePath: string) => {
    const { data, error: signedError } = await supabaseClient.storage
      .from("booking-media")
      .createSignedUrl(storagePath, 60 * 60); // 1 hour

    if (signedError) {
      console.error(signedError);
      setError(signedError.message);
      return;
    }

    const url = data?.signedUrl;
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleRemove = async (file: MediaFile) => {
    const confirmDelete = window.confirm(
      `Remove "${file.file_name || file.storage_path}"?`
    );
    if (!confirmDelete) return;

    setDeletingId(file.id);
    setError(null);

    // Delete DB row first — a dangling storage file is less harmful
    // than a DB row pointing to a deleted file.
    const { error: deleteError } = await supabaseClient
      .from("booking_media_files")
      .delete()
      .eq("id", file.id);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      setDeletingId(null);
      return;
    }

    const { error: storageError } = await supabaseClient.storage
      .from("booking-media")
      .remove([file.storage_path]);

    if (storageError) {
      console.error("Storage cleanup failed (DB row already removed):", storageError);
    }

    await refresh();
    setDeletingId(null);
  };

  // Client-side UI gate only; actual delete authorization is enforced by Supabase RLS.
  const canRemove = ["pilot", "admin", "owner"].includes(role || "");
  const formatUploader = (uploaderId: string | null) => {
    if (!uploaderId) return "—";
    return uploaders[uploaderId] || uploaderId;
  };

  return (
    <div className="media-card">
      <div className="media-header">
        <h3 style={{ margin: 0 }}>Media</h3>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{ height: 32 }}
          aria-label="Media kind"
        >
          <option value="raw">Raw</option>
          <option value="proxy">Proxy</option>
          <option value="final">Final</option>
          <option value="notes">Notes</option>
        </select>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          <span className="button-like">
            {uploading ? "Uploading..." : "Upload file"}
          </span>
          <input
            type="file"
            accept="video/*,application/pdf,image/*"
            disabled={uploading}
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        </label>
      </div>
      {error && <p style={{ color: "red" }} role="alert">{error}</p>}
      {loading ? (
        <p aria-live="polite">Loading media...</p>
      ) : (
        <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Kind</th>
              <th scope="col">Role</th>
              <th scope="col">Uploaded By</th>
              <th scope="col">Name</th>
              <th scope="col">Size</th>
              <th scope="col">Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.kind}</td>
                <td>{file.role}</td>
                <td>{formatUploader(file.uploaded_by)}</td>
                <td>{file.file_name || file.storage_path}</td>
                <td>{formatFileSize(file.file_size)}</td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="button-like"
                      onClick={() => handleDownload(file.storage_path)}
                    >
                      Download
                    </button>
                    {canRemove && (
                      <button
                        className="button-like danger-btn"
                        onClick={() => handleRemove(file)}
                        disabled={deletingId === file.id}
                      >
                        {deletingId === file.id ? "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!files.length && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  No media uploaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
};
