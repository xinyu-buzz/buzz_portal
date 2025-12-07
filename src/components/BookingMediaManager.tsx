import { useEffect, useState } from "react";
import { supabaseClient } from "../utility";

type MediaFile = {
  id: string;
  booking_id: string;
  role: string;
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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [kind, setKind] = useState<string>("raw");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
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
      setError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [bookingId]);

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

  return (
    <div className="media-card">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Media</h3>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{ height: 32 }}
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
      {error && <p style={{ color: "red" }}>{error}</p>}
      {loading ? (
        <p>Loading media...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Role</th>
              <th>Name</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.id}>
                <td>{file.kind}</td>
                <td>{file.role}</td>
                <td>{file.file_name || file.storage_path}</td>
                <td>
                  {file.file_size
                    ? `${(file.file_size / 1024 / 1024).toFixed(1)} MB`
                    : "—"}
                </td>
                <td>{new Date(file.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => handleDownload(file.storage_path)}>
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {!files.length && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  No media uploaded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};
