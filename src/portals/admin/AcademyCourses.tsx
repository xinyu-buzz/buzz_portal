import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";

type TrainingCourse = {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  category: "Mandatory" | "Extension" | "Intermediate" | "Advanced" | "Specialized" | "General";
  instructor: string;
  rating: number;
  students_count: number;
  created_at: string;
  updated_at: string;
  provider: "Buzz" | "Red Cross" | "USFA" | "FEMA" | "Amazon" | "T-Mobile" | "Other";
  instructor_picture_url: string | null;
  requires_uas_ground_school: boolean;
  requires_flight_review_passed: boolean;
  requires_roc_a_passed: boolean;
  external_url: string | null;
};

const PROVIDERS = ["Buzz", "Red Cross", "USFA", "FEMA", "Amazon", "T-Mobile", "Other"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const CATEGORIES = ["Mandatory", "Extension", "Intermediate", "Advanced", "Specialized", "General"];

export const AcademyCourses = () => {
  const [rows, setRows] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    duration: "",
    level: "Beginner",
    category: "Mandatory",
    instructor: "",
    provider: "Buzz",
    instructor_picture_url: "",
    requires_uas_ground_school: false,
    requires_flight_review_passed: false,
    requires_roc_a_passed: false,
    external_url: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabaseClient
      .from("training_courses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (loadError) {
      console.error("Failed to load training courses", loadError);
      setError(loadError.message);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setForm((prev) => ({ ...prev, [name]: checked }));
    } else {
      setForm((prev) => {
        const newForm = { ...prev, [name]: value };
        // If provider changes to non-Buzz, set category to "General"
        if (name === "provider" && value !== "Buzz") {
          newForm.category = "General";
        }
        // If provider changes to Buzz and category is "General", set to "Mandatory"
        if (name === "provider" && value === "Buzz" && prev.category === "General") {
          newForm.category = "Mandatory";
        }
        return newForm;
      });
    }
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      duration: "",
      level: "Beginner",
      category: "Mandatory",
      instructor: "",
      provider: "Buzz",
      instructor_picture_url: "",
      requires_uas_ground_school: false,
      requires_flight_review_passed: false,
      requires_roc_a_passed: false,
      external_url: "",
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!form.title || !form.description || !form.duration || !form.instructor || !form.category) {
      setError("Please fill all required fields.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, any> = {
      title: form.title,
      description: form.description,
      duration: form.duration,
      level: form.level,
      category: form.category,
      instructor: form.instructor,
      provider: form.provider,
      requires_uas_ground_school: form.requires_uas_ground_school,
      requires_flight_review_passed: form.requires_flight_review_passed,
      requires_roc_a_passed: form.requires_roc_a_passed,
    };

    if (form.instructor_picture_url) {
      payload.instructor_picture_url = form.instructor_picture_url;
    }

    if (form.external_url) {
      payload.external_url = form.external_url;
    }

    const { error: insertError } = await supabaseClient
      .from("training_courses")
      .insert(payload);

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setShowCreate(false);
    setSubmitting(false);
    resetForm();
    await load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    setSubmitting(true);
    setError(null);

    if (!form.title || !form.description || !form.duration || !form.instructor || !form.category) {
      setError("Please fill all required fields.");
      setSubmitting(false);
      return;
    }

    const payload: Record<string, any> = {
      title: form.title,
      description: form.description,
      duration: form.duration,
      level: form.level,
      category: form.category,
      instructor: form.instructor,
      provider: form.provider,
      requires_uas_ground_school: form.requires_uas_ground_school,
      requires_flight_review_passed: form.requires_flight_review_passed,
      requires_roc_a_passed: form.requires_roc_a_passed,
    };

    if (form.instructor_picture_url) {
      payload.instructor_picture_url = form.instructor_picture_url;
    } else {
      payload.instructor_picture_url = null;
    }

    if (form.external_url) {
      payload.external_url = form.external_url;
    } else {
      payload.external_url = null;
    }

    const { data, error: updateError } = await supabaseClient
      .from("training_courses")
      .update(payload)
      .eq("id", editingCourse.id)
      .select();

    if (updateError) {
      console.error("Update error:", updateError);
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setShowEdit(false);
    setEditingCourse(null);
    setSubmitting(false);
    resetForm();
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    const { error: deleteError } = await supabaseClient
      .from("training_courses")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    await load();
  };

  const openEdit = (course: TrainingCourse) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description,
      duration: course.duration,
      level: course.level,
      category: course.category,
      instructor: course.instructor,
      provider: course.provider,
      instructor_picture_url: course.instructor_picture_url || "",
      requires_uas_ground_school: course.requires_uas_ground_school,
      requires_flight_review_passed: course.requires_flight_review_passed,
      requires_roc_a_passed: course.requires_roc_a_passed,
      external_url: course.external_url || "",
    });
    setShowEdit(true);
  };

  const closeModals = () => {
    setShowCreate(false);
    setShowEdit(false);
    setEditingCourse(null);
    resetForm();
    setError(null);
  };

  const clearFilters = () => {
    setSelectedProvider(null);
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const activeFilterCount = [
    selectedProvider,
    selectedCategory,
    searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const filteredRows = rows.filter((row) => {
    if (selectedProvider && row.provider !== selectedProvider) return false;
    if (selectedCategory && row.category !== selectedCategory) return false;
    if (searchQuery && !row.title.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="page-card">
      <div className="page-header">
        <h1>Academy Courses</h1>
        <button className="primary-btn" onClick={() => setShowCreate(true)}>
          + New course
        </button>
      </div>

      {error && !showCreate && !showEdit && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Filter Section */}
      <div
        style={{
          backgroundColor: "rgba(107, 140, 174, 0.1)",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            gap: "16px",
          }}
        >
          <input
            type="text"
            placeholder="Search courses by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "8px",
              color: "white",
              fontSize: "14px",
            }}
          />
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {activeFilterCount > 0 && (
              <button
                className="ghost-btn"
                onClick={clearFilters}
                style={{ fontSize: "14px" }}
              >
                Clear filters
              </button>
            )}
            <button
              className="ghost-btn"
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
              }}
            >
              <span>☰</span>
              Filter
              {activeFilterCount > 0 && (
                <span
                  style={{
                    backgroundColor: "#6b8cae",
                    color: "white",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Provider Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Provider
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider}
                    onClick={() =>
                      setSelectedProvider(
                        selectedProvider === provider ? null : provider
                      )
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: "none",
                      backgroundColor:
                        selectedProvider === provider
                          ? "#6b8cae"
                          : "rgba(255, 255, 255, 0.1)",
                      color: selectedProvider === provider ? "white" : "#9ca3b5",
                      cursor: "pointer",
                      fontSize: "14px",
                      transition: "all 0.2s",
                    }}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Filter - Only show if provider is selected */}
            {selectedProvider && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "12px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  Category
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: "none",
                      backgroundColor:
                        selectedCategory === null
                          ? "#6b8cae"
                          : "rgba(255, 255, 255, 0.1)",
                      color: selectedCategory === null ? "white" : "#9ca3b5",
                      cursor: "pointer",
                      fontSize: "14px",
                      transition: "all 0.2s",
                    }}
                  >
                    All
                  </button>
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() =>
                        setSelectedCategory(
                          selectedCategory === category ? null : category
                        )
                      }
                      style={{
                        padding: "8px 16px",
                        borderRadius: "20px",
                        border: "none",
                        backgroundColor:
                          selectedCategory === category
                            ? "#6b8cae"
                            : "rgba(255, 255, 255, 0.1)",
                        color:
                          selectedCategory === category ? "white" : "#9ca3b5",
                        cursor: "pointer",
                        fontSize: "14px",
                        transition: "all 0.2s",
                      }}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {activeFilterCount > 0 && (
            <p style={{ marginBottom: "16px", color: "#9ca3b5" }}>
              Showing {filteredRows.length} of {rows.length} courses
            </p>
          )}
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Provider</th>
                <th>Category</th>
                <th>Level</th>
                <th>Duration</th>
                <th>Instructor</th>
                <th>Rating</th>
                <th>Students</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.provider}</td>
                  <td>{row.category}</td>
                  <td>{row.level}</td>
                  <td>{row.duration}</td>
                  <td>{row.instructor}</td>
                  <td>{row.rating.toFixed(1)}</td>
                  <td>{row.students_count}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="primary-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => handleDelete(row.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center" }}>
                    {rows.length > 0
                      ? "No courses match the selected filters."
                      : "No courses yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {(showCreate || showEdit) && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 700 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {showCreate ? "Create Course" : "Edit Course"}
              </h3>
              <button className="ghost-btn" onClick={closeModals}>
                Close
              </button>
            </div>
            <form
              className="modal-form"
              onSubmit={showCreate ? handleCreate : handleUpdate}
            >
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Title *</label>
              <input
                name="title"
                value={form.title}
                onChange={onChange}
                className="text-input"
                placeholder="Course title"
                required
              />

              <label className="input-label">Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={onChange}
                className="text-input"
                rows={4}
                placeholder="Course description"
                required
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Provider *</label>
                  <select
                    name="provider"
                    value={form.provider}
                    onChange={onChange}
                    className="text-input"
                    required
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Duration *</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      name="duration"
                      type="number"
                      value={form.duration.replace(/[^\d]/g, "")}
                      onChange={(e) => {
                        const numericValue = e.target.value;
                        setForm((prev) => ({ 
                          ...prev, 
                          duration: numericValue ? `${numericValue} hours` : "" 
                        }));
                      }}
                      className="text-input"
                      placeholder="25"
                      min="1"
                      style={{ flex: 1 }}
                      required
                    />
                    <span style={{ color: "#9ca3b5", fontSize: "14px" }}>hours</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Category *</label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={onChange}
                    className="text-input"
                    required
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Level *</label>
                  <select
                    name="level"
                    value={form.level}
                    onChange={onChange}
                    className="text-input"
                    required
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="input-label">Instructor *</label>
              <input
                name="instructor"
                value={form.instructor}
                onChange={onChange}
                className="text-input"
                placeholder="Instructor name"
                required
              />

              <label className="input-label">Instructor Picture URL</label>
              <input
                name="instructor_picture_url"
                value={form.instructor_picture_url}
                onChange={onChange}
                className="text-input"
                placeholder="https://example.com/image.jpg"
                type="url"
              />

              {form.provider !== "Buzz" && (
                <>
                  <label className="input-label">External URL</label>
                  <input
                    name="external_url"
                    value={form.external_url}
                    onChange={onChange}
                    className="text-input"
                    placeholder="https://example.com/course"
                    type="url"
                  />
                </>
              )}

              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <label className="input-label" style={{ fontWeight: 600 }}>
                  Prerequisites
                </label>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="requires_uas_ground_school"
                    checked={form.requires_uas_ground_school}
                    onChange={onChange}
                  />
                  <span>Requires UAS Ground School</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="requires_flight_review_passed"
                    checked={form.requires_flight_review_passed}
                    onChange={onChange}
                  />
                  <span>Requires Flight Review Passed</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="requires_roc_a_passed"
                    checked={form.requires_roc_a_passed}
                    onChange={onChange}
                  />
                  <span>Requires ROC-A Passed</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting
                    ? showCreate
                      ? "Creating..."
                      : "Updating..."
                    : showCreate
                      ? "Create course"
                      : "Update course"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeModals}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
