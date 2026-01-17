import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility";

type CourseSection = {
  id: string;
  course_id: string;
  name: string;
  display_order: number;
  description: string | null;
  section_type: string;
  requires_subscription: boolean;
  requires_test_passed: boolean;
  prerequisite_section_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  exam_type: string | null;
};

type CourseUnit = {
  id: string;
  course_id: string;
  unit_number: number;
  title: string;
  description: string | null;
  content: string | null;
  step_number: number | null;
  is_mandatory: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  pdf_url: any;
  section_id: string | null;
};

type TrainingCourse = {
  id: string;
  title: string;
  provider: string;
};

export const CourseUnitsManager = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sectionForm, setSectionForm] = useState({
    name: "",
    description: "",
    display_order: 0,
  });

  const [unitForm, setUnitForm] = useState({
    title: "",
    description: "",
    content: "",
    unit_number: 0,
    order_index: 0,
    is_mandatory: false,
    section_id: "",
  });

  useEffect(() => {
    if (courseId) {
      loadData();
    }
  }, [courseId]);

  const loadData = async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);

    try {
      // Load course
      const { data: courseData, error: courseError } = await supabaseClient
        .from("training_courses")
        .select("id, title, provider")
        .eq("id", courseId)
        .single();

      if (courseError) throw courseError;
      
      if (courseData.provider !== "Buzz") {
        setError("This page is only available for Buzz courses.");
        setLoading(false);
        return;
      }

      setCourse(courseData);

      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabaseClient
        .from("course_sections")
        .select("*")
        .eq("course_id", courseId)
        .order("display_order", { ascending: true });

      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);

      // Load units
      const { data: unitsData, error: unitsError } = await supabaseClient
        .from("course_units")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (unitsError) throw unitsError;
      setUnits(unitsData || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    }

    setLoading(false);
  };

  // Section handlers
  const openSectionForm = (section?: CourseSection) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({
        name: section.name,
        description: section.description || "",
        display_order: section.display_order,
      });
    } else {
      setEditingSection(null);
      setSectionForm({
        name: "",
        description: "",
        display_order: sections.length + 1,
      });
    }
    setShowSectionForm(true);
  };

  const closeSectionForm = () => {
    setShowSectionForm(false);
    setEditingSection(null);
    setSectionForm({
      name: "",
      description: "",
      display_order: 0,
    });
    setError(null);
  };

  const handleSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      if (editingSection) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_sections")
          .update({
            name: sectionForm.name,
            description: sectionForm.description,
            display_order: sectionForm.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSection.id);

        if (updateError) throw updateError;
      } else {
        // Create
        const { error: insertError } = await supabaseClient
          .from("course_sections")
          .insert({
            course_id: courseId,
            name: sectionForm.name,
            description: sectionForm.description,
            display_order: sectionForm.display_order,
          });

        if (insertError) throw insertError;
      }

      closeSectionForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving section:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Are you sure you want to delete this section? Units in this section will be unassigned.")) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from("course_sections")
        .delete()
        .eq("id", sectionId);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error("Error deleting section:", err);
      setError(err.message);
    }
  };

  // Unit handlers
  const openUnitForm = (unit?: CourseUnit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitForm({
        title: unit.title,
        description: unit.description || "",
        content: unit.content || "",
        unit_number: unit.unit_number,
        order_index: unit.order_index,
        is_mandatory: unit.is_mandatory,
        section_id: unit.section_id || "",
      });
    } else {
      setEditingUnit(null);
      setUnitForm({
        title: "",
        description: "",
        content: "",
        unit_number: units.length + 1,
        order_index: units.length + 1,
        is_mandatory: false,
        section_id: "",
      });
    }
    setShowUnitForm(true);
  };

  const closeUnitForm = () => {
    setShowUnitForm(false);
    setEditingUnit(null);
    setUnitForm({
      title: "",
      description: "",
      content: "",
      unit_number: 0,
      order_index: 0,
      is_mandatory: false,
      section_id: "",
    });
    setError(null);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        title: unitForm.title,
        description: unitForm.description,
        content: unitForm.content,
        unit_number: unitForm.unit_number,
        order_index: unitForm.order_index,
        is_mandatory: unitForm.is_mandatory,
        section_id: unitForm.section_id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingUnit) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_units")
          .update(payload)
          .eq("id", editingUnit.id);

        if (updateError) throw updateError;
      } else {
        // Create
        payload.course_id = courseId;
        const { error: insertError } = await supabaseClient
          .from("course_units")
          .insert(payload);

        if (insertError) throw insertError;
      }

      closeUnitForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving unit:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!confirm("Are you sure you want to delete this unit?")) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from("course_units")
        .delete()
        .eq("id", unitId);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error("Error deleting unit:", err);
      setError(err.message);
    }
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return "Unassigned";
    const section = sections.find(s => s.id === sectionId);
    return section?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="page-card">
        <p>Loading...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page-card">
        <div className="alert error">Course not found or not a Buzz course.</div>
        <button className="ghost-btn" onClick={() => navigate("/admin/academy-courses")}>
          Back to Courses
        </button>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div className="page-header">
        <div>
          <button 
            className="ghost-btn" 
            onClick={() => navigate("/admin/academy-courses")}
            style={{ marginBottom: 12 }}
          >
            ← Back to Courses
          </button>
          <h1>Course Units & Sections</h1>
          <p style={{ color: "#9ca3b5", marginTop: 8 }}>{course.title}</p>
        </div>
      </div>

      {error && !showSectionForm && !showUnitForm && (
        <div className="alert error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Sections Section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Sections</h2>
          <button className="primary-btn" onClick={() => openSectionForm()}>
            + New Section
          </button>
        </div>

        {sections.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No sections yet. Sections help organize units into folders.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Description</th>
                <th>Units Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.id}>
                  <td>{section.display_order}</td>
                  <td>{section.name}</td>
                  <td>{section.description || "-"}</td>
                  <td>{units.filter(u => u.section_id === section.id).length}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="primary-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => openSectionForm(section)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => handleDeleteSection(section.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Units Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Units</h2>
          <button className="primary-btn" onClick={() => openUnitForm()}>
            + New Unit
          </button>
        </div>

        {units.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No units yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Unit #</th>
                <th>Title</th>
                <th>Section</th>
                <th>Mandatory</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.order_index}</td>
                  <td>{unit.unit_number}</td>
                  <td>{unit.title}</td>
                  <td>{getSectionName(unit.section_id)}</td>
                  <td>{unit.is_mandatory ? "Yes" : "No"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="primary-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => openUnitForm(unit)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => handleDeleteUnit(unit.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section Form Modal */}
      {showSectionForm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editingSection ? "Edit Section" : "Create Section"}
              </h3>
              <button className="ghost-btn" onClick={closeSectionForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleSectionSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Name *</label>
              <input
                name="name"
                value={sectionForm.name}
                onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value })}
                className="text-input"
                placeholder="Section name"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={sectionForm.description}
                onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <label className="input-label">Display Order *</label>
              <input
                name="display_order"
                type="number"
                value={sectionForm.display_order}
                onChange={(e) => setSectionForm({ ...sectionForm, display_order: parseInt(e.target.value) })}
                className="text-input"
                placeholder="1"
                min="1"
                required
              />

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingSection ? "Update Section" : "Create Section"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeSectionForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Form Modal */}
      {showUnitForm && (
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
                {editingUnit ? "Edit Unit" : "Create Unit"}
              </h3>
              <button className="ghost-btn" onClick={closeUnitForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleUnitSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Title *</label>
              <input
                name="title"
                value={unitForm.title}
                onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                className="text-input"
                placeholder="Unit title"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={unitForm.description}
                onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <label className="input-label">Content</label>
              <textarea
                name="content"
                value={unitForm.content}
                onChange={(e) => setUnitForm({ ...unitForm, content: e.target.value })}
                className="text-input"
                rows={6}
                placeholder="Unit content"
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Unit Number *</label>
                  <input
                    name="unit_number"
                    type="number"
                    value={unitForm.unit_number}
                    onChange={(e) => setUnitForm({ ...unitForm, unit_number: parseInt(e.target.value) })}
                    className="text-input"
                    placeholder="1"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Order Index *</label>
                  <input
                    name="order_index"
                    type="number"
                    value={unitForm.order_index}
                    onChange={(e) => setUnitForm({ ...unitForm, order_index: parseInt(e.target.value) })}
                    className="text-input"
                    placeholder="1"
                    min="1"
                    required
                  />
                </div>
              </div>

              <label className="input-label">Section</label>
              <select
                name="section_id"
                value={unitForm.section_id}
                onChange={(e) => setUnitForm({ ...unitForm, section_id: e.target.value })}
                className="text-input"
              >
                <option value="">No section (Unassigned)</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <input
                  type="checkbox"
                  name="is_mandatory"
                  checked={unitForm.is_mandatory}
                  onChange={(e) => setUnitForm({ ...unitForm, is_mandatory: e.target.checked })}
                />
                <span>Mandatory unit</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingUnit ? "Update Unit" : "Create Unit"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeUnitForm}
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
