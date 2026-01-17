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

type CourseTest = {
  id: string;
  course_id: string;
  test_name: string;
  test_description: string | null;
  test_type: "multiple_choice" | "practical" | "written" | "oral";
  passing_score: number;
  required_for_progression: boolean;
  required_units: number[];
  order_index: number;
  questions: any;
  is_active: boolean;
  section_id: string | null;
  created_at: string;
  updated_at: string;
};

const TEST_TYPES = ["multiple_choice", "practical", "written", "oral"] as const;

export const CourseUnitsManager = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [tests, setTests] = useState<CourseTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);
  const [editingTest, setEditingTest] = useState<CourseTest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

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

  const [testForm, setTestForm] = useState({
    test_name: "",
    test_description: "",
    test_type: "multiple_choice" as "multiple_choice" | "practical" | "written" | "oral",
    passing_score: 70,
    required_for_progression: true,
    required_units: [] as number[],
    order_index: 0,
    is_active: true,
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

      // Load tests
      const { data: testsData, error: testsError } = await supabaseClient
        .from("course_tests")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });

      if (testsError) throw testsError;
      setTests(testsData || []);
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

  // Helper to strip "UNIT X - " prefix from title if present
  const stripUnitPrefix = (title: string): string => {
    return title.replace(/^UNIT\s*\d+\s*-\s*/i, "");
  };

  // Unit handlers
  const openUnitForm = (unit?: CourseUnit) => {
    if (unit) {
      setEditingUnit(unit);
      setUnitForm({
        title: stripUnitPrefix(unit.title),
        description: unit.description || "",
        content: unit.content || "",
        unit_number: unit.unit_number,
        order_index: unit.order_index,
        is_mandatory: unit.is_mandatory,
        section_id: unit.section_id || "",
      });
      // Set current PDF URL if exists
      setCurrentPdfUrl(unit.pdf_url || null);
      setPdfFile(null);
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
      setCurrentPdfUrl(null);
      setPdfFile(null);
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
    setPdfFile(null);
    setCurrentPdfUrl(null);
    setError(null);
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        setError('Please select a valid PDF file');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('PDF size must be less than 10MB');
        return;
      }

      setPdfFile(file);
      setError(null);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setCurrentPdfUrl(null);
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      let pdfUrl: string | null = currentPdfUrl;

      // Upload PDF if provided
      if (pdfFile) {
        setUploadingPdf(true);
        try {
          const fileExt = pdfFile.name.split('.').pop();
          const fileName = `unit-${unitForm.unit_number}-${Date.now()}.${fileExt}`;
          const filePath = `${fileName}`;

          const { error: uploadError } = await supabaseClient.storage
            .from('course-materials')
            .upload(filePath, pdfFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: publicUrlData } = supabaseClient.storage
            .from('course-materials')
            .getPublicUrl(filePath);

          pdfUrl = publicUrlData.publicUrl;
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload PDF: ${uploadError.message}`);
          setSubmitting(false);
          setUploadingPdf(false);
          return;
        }
        setUploadingPdf(false);
      }

      // Prepend "UNIT X - " to the title for database storage
      const fullTitle = `UNIT ${unitForm.unit_number} - ${unitForm.title}`;
      
      const payload: any = {
        title: fullTitle,
        description: unitForm.description,
        content: unitForm.content,
        unit_number: unitForm.unit_number,
        order_index: unitForm.order_index,
        is_mandatory: unitForm.is_mandatory,
        section_id: unitForm.section_id || null,
        pdf_url: pdfUrl,
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

  // Test handlers
  const openTestForm = (test?: CourseTest) => {
    if (test) {
      setEditingTest(test);
      setTestForm({
        test_name: test.test_name,
        test_description: test.test_description || "",
        test_type: test.test_type,
        passing_score: test.passing_score,
        required_for_progression: test.required_for_progression,
        required_units: test.required_units || [],
        order_index: test.order_index,
        is_active: test.is_active,
        section_id: test.section_id || "",
      });
    } else {
      setEditingTest(null);
      setTestForm({
        test_name: "",
        test_description: "",
        test_type: "multiple_choice",
        passing_score: 70,
        required_for_progression: true,
        required_units: [],
        order_index: tests.length + 1,
        is_active: true,
        section_id: "",
      });
    }
    setShowTestForm(true);
  };

  const closeTestForm = () => {
    setShowTestForm(false);
    setEditingTest(null);
    setTestForm({
      test_name: "",
      test_description: "",
      test_type: "multiple_choice",
      passing_score: 70,
      required_for_progression: true,
      required_units: [],
      order_index: 0,
      is_active: true,
      section_id: "",
    });
    setError(null);
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        test_name: testForm.test_name,
        test_description: testForm.test_description,
        test_type: testForm.test_type,
        passing_score: testForm.passing_score,
        required_for_progression: testForm.required_for_progression,
        required_units: testForm.required_units,
        order_index: testForm.order_index,
        is_active: testForm.is_active,
        section_id: testForm.section_id || null,
        updated_at: new Date().toISOString(),
      };

      if (editingTest) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("course_tests")
          .update(payload)
          .eq("id", editingTest.id);

        if (updateError) throw updateError;
      } else {
        // Create
        payload.course_id = courseId;
        const { error: insertError } = await supabaseClient
          .from("course_tests")
          .insert(payload);

        if (insertError) throw insertError;
      }

      closeTestForm();
      await loadData();
    } catch (err: any) {
      console.error("Error saving test:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Are you sure you want to delete this test?")) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from("course_tests")
        .delete()
        .eq("id", testId);

      if (deleteError) throw deleteError;
      await loadData();
    } catch (err: any) {
      console.error("Error deleting test:", err);
      setError(err.message);
    }
  };

  const toggleUnitSelection = (unitNumber: number) => {
    setTestForm(prev => ({
      ...prev,
      required_units: prev.required_units.includes(unitNumber)
        ? prev.required_units.filter(u => u !== unitNumber)
        : [...prev.required_units, unitNumber].sort((a, b) => a - b)
    }));
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
          <h1>Course Manager</h1>
          <p style={{ color: "#9ca3b5", marginTop: 8 }}>{course.title}</p>
        </div>
      </div>

      {error && !showSectionForm && !showUnitForm && !showTestForm && (
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
                  <td>UNIT {unit.unit_number} - {stripUnitPrefix(unit.title)}</td>
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

      {/* Tests Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Tests</h2>
          <button className="primary-btn" onClick={() => openTestForm()}>
            + New Test
          </button>
        </div>

        {tests.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No tests yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Test Name</th>
                <th>Type</th>
                <th>Passing Score</th>
                <th>Section</th>
                <th>Required Units</th>
                <th>Required</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id}>
                  <td>{test.order_index}</td>
                  <td>{test.test_name}</td>
                  <td style={{ textTransform: "capitalize" }}>
                    {test.test_type.replace("_", " ")}
                  </td>
                  <td>{test.passing_score}%</td>
                  <td>{getSectionName(test.section_id)}</td>
                  <td>
                    {test.required_units && test.required_units.length > 0
                      ? test.required_units.sort((a, b) => a - b).join(", ")
                      : "None"}
                  </td>
                  <td>{test.required_for_progression ? "Yes" : "No"}</td>
                  <td>{test.is_active ? "Yes" : "No"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="primary-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => openTestForm(test)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={() => handleDeleteTest(test.id)}
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

              <label className="input-label">Unit Number & Title *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <span style={{ color: "#9ca3b5", fontWeight: 500 }}>UNIT</span>
                  <input
                    name="unit_number"
                    type="number"
                    value={unitForm.unit_number}
                    onChange={(e) => setUnitForm({ ...unitForm, unit_number: parseInt(e.target.value) || 0 })}
                    className="text-input"
                    placeholder="1"
                    min="1"
                    style={{ width: "80px" }}
                    required
                  />
                  <span style={{ color: "#9ca3b5", fontWeight: 500 }}>-</span>
                </div>
                <input
                  name="title"
                  value={unitForm.title}
                  onChange={(e) => setUnitForm({ ...unitForm, title: e.target.value })}
                  className="text-input"
                  placeholder="Unit title"
                  style={{ flex: 1 }}
                  required
                />
              </div>

              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={unitForm.description}
                onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <label className="input-label">Unit PDF Material</label>
              <div style={{ marginBottom: 16 }}>
                {currentPdfUrl && !pdfFile ? (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'rgba(107, 140, 174, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(107, 140, 174, 0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>📄</span>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>Current PDF</p>
                          <a 
                            href={currentPdfUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: '12px', color: '#6b8cae' }}
                          >
                            View PDF
                          </a>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={removePdf}
                        style={{
                          backgroundColor: 'rgba(220, 38, 38, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : pdfFile ? (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'rgba(107, 140, 174, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(107, 140, 174, 0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '24px' }}>📄</span>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>{pdfFile.name}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#9ca3b5' }}>
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPdfFile(null)}
                        style={{
                          backgroundColor: 'rgba(220, 38, 38, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '6px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '32px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('pdf-upload-input')?.click()}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
                    <p style={{ color: '#9ca3b5', margin: 0 }}>
                      Click to upload PDF material
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                      PDF only (max 10MB)
                    </p>
                  </div>
                )}
                <input
                  id="pdf-upload-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfFileChange}
                  style={{ display: 'none' }}
                />
              </div>

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
                <button type="submit" className="primary-btn" disabled={submitting || uploadingPdf}>
                  {uploadingPdf
                    ? "Uploading PDF..."
                    : submitting
                    ? "Saving..."
                    : editingUnit
                    ? "Update Unit"
                    : "Create Unit"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeUnitForm}
                  disabled={submitting || uploadingPdf}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Form Modal */}
      {showTestForm && (
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
                {editingTest ? "Edit Test" : "Create Test"}
              </h3>
              <button className="ghost-btn" onClick={closeTestForm}>
                Close
              </button>
            </div>
            <form className="modal-form" onSubmit={handleTestSubmit}>
              {error && <div className="alert error">{error}</div>}

              <label className="input-label">Test Name *</label>
              <input
                name="test_name"
                value={testForm.test_name}
                onChange={(e) => setTestForm({ ...testForm, test_name: e.target.value })}
                className="text-input"
                placeholder="Test name"
                required
              />

              <label className="input-label">Description</label>
              <textarea
                name="test_description"
                value={testForm.test_description}
                onChange={(e) => setTestForm({ ...testForm, test_description: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Optional description"
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Test Type *</label>
                  <select
                    name="test_type"
                    value={testForm.test_type}
                    onChange={(e) => setTestForm({ ...testForm, test_type: e.target.value as any })}
                    className="text-input"
                    required
                  >
                    {TEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">Passing Score *</label>
                  <input
                    name="passing_score"
                    type="number"
                    value={testForm.passing_score}
                    onChange={(e) => setTestForm({ ...testForm, passing_score: parseInt(e.target.value) })}
                    className="text-input"
                    placeholder="70"
                    min="0"
                    max="100"
                    required
                  />
                </div>
              </div>

              <label className="input-label">Order Index *</label>
              <input
                name="order_index"
                type="number"
                value={testForm.order_index}
                onChange={(e) => setTestForm({ ...testForm, order_index: parseInt(e.target.value) })}
                className="text-input"
                placeholder="1"
                min="1"
                required
              />

              <label className="input-label">Section</label>
              <select
                name="section_id"
                value={testForm.section_id}
                onChange={(e) => setTestForm({ ...testForm, section_id: e.target.value })}
                className="text-input"
              >
                <option value="">No section (Unassigned)</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>

              <label className="input-label">Required Units</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)"
                }}
              >
                {units.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No units available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {units.map((unit) => (
                      <label 
                        key={unit.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8,
                          padding: "8px",
                          backgroundColor: testForm.required_units.includes(unit.unit_number) 
                            ? "rgba(107, 140, 174, 0.2)" 
                            : "transparent",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={testForm.required_units.includes(unit.unit_number)}
                          onChange={() => toggleUnitSelection(unit.unit_number)}
                        />
                        <span>Unit {unit.unit_number}: {unit.title}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="required_for_progression"
                    checked={testForm.required_for_progression}
                    onChange={(e) => setTestForm({ ...testForm, required_for_progression: e.target.checked })}
                  />
                  <span>Required for progression</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={testForm.is_active}
                    onChange={(e) => setTestForm({ ...testForm, is_active: e.target.checked })}
                  />
                  <span>Active test</span>
                </label>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingTest ? "Update Test" : "Create Test"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeTestForm}
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
