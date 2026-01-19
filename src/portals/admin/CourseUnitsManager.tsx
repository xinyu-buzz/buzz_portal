import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabaseClient } from "../../utility";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { TestQuestionsManager } from "./TestQuestionsManager";
import { PracticalTestCriteriaManager } from "./PracticalTestCriteriaManager";

const PDF_ITEM_TYPE = "PDF_ITEM";
const SECTION_ITEM_TYPE = "SECTION_ITEM";
const UNIT_ITEM_TYPE = "UNIT_ITEM";
const TEST_ITEM_TYPE = "TEST_ITEM";

type DraggablePDFItemProps = {
  index: number;
  url: string;
  name: string;
  onNameChange: (index: number, name: string) => void;
  onRemove: (index: number) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggablePDFItem = ({ index, url, name, onNameChange, onRemove, onMove }: DraggablePDFItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: PDF_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: PDF_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      style={{
        padding: '12px',
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.2)' : 'rgba(107, 140, 174, 0.1)',
        borderRadius: '8px',
        border: '1px solid rgba(107, 140, 174, 0.3)',
        marginBottom: '8px',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: 'background-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            cursor: 'grab',
            padding: '4px',
            color: '#9ca3b5',
          }}
        >
          <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮⋮</span>
        </div>

        {/* PDF icon */}
        <span style={{ fontSize: '24px' }}>📄</span>

        {/* Editable name input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(index, e.target.value)}
            className="text-input"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '14px',
              marginBottom: '4px',
            }}
            placeholder="Enter material name"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: '#6b8cae',
              display: 'block',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            View Material
          </a>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          style={{
            backgroundColor: 'rgba(220, 38, 38, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
};

type DraggableSectionItemProps = {
  section: CourseSection;
  index: number;
  unitsCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggableSectionItem = ({ section, index, unitsCount, onEdit, onDelete, onMove }: DraggableSectionItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: SECTION_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: SECTION_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'transparent',
        cursor: 'grab',
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          <span>{section.display_order}</span>
        </div>
      </td>
      <td>{section.name}</td>
      <td>{section.description || "-"}</td>
      <td>{unitsCount}</td>
      <td>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12 }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

type DraggableUnitItemProps = {
  unit: CourseUnit;
  index: number;
  sectionName: string;
  prerequisitesText: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  stripUnitPrefix: (title: string) => string;
  isFirstInSection: boolean;
  sectionColor: string;
};

const DraggableUnitItem = ({ unit, index, sectionName, prerequisitesText, onEdit, onDelete, onMove, stripUnitPrefix, isFirstInSection, sectionColor }: DraggableUnitItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: UNIT_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: UNIT_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : sectionColor,
        cursor: 'grab',
        borderTop: isFirstInSection && index > 0 ? '2px solid rgba(107, 140, 174, 0.4)' : undefined,
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          <span>{unit.order_index}</span>
        </div>
      </td>
      <td>UNIT {unit.unit_number} - {stripUnitPrefix(unit.title)}</td>
      <td>{sectionName}</td>
      <td>{prerequisitesText}</td>
      <td>{unit.is_mandatory ? "Yes" : "No"}</td>
      <td>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

type DraggableTestItemProps = {
  test: CourseTest;
  index: number;
  sectionName: string;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onManageQuestions?: () => void;
};

const DraggableTestItem = ({ test, index, sectionName, onEdit, onDelete, onMove, onManageQuestions }: DraggableTestItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: TEST_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: TEST_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  drag(drop(ref));

  return (
    <tr
      ref={ref}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? 'rgba(107, 140, 174, 0.15)' : 'transparent',
        cursor: 'grab',
      }}
    >
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#9ca3b5', cursor: 'grab', fontSize: '14px' }}>⋮⋮</span>
          <span>{test.order_index}</span>
        </div>
      </td>
      <td>{test.test_name}</td>
      <td style={{ textTransform: "capitalize" }}>
        {test.test_type.replace("_", " ")}
      </td>
      <td>{test.passing_score}%</td>
      <td>{sectionName}</td>
      <td>
        {test.required_units && test.required_units.length > 0
          ? test.required_units.sort((a, b) => a - b).join(", ")
          : "None"}
      </td>
      <td>{test.required_for_progression ? "Yes" : "No"}</td>
      <td>{test.needs_proctor ? "Yes" : "No"}</td>
      <td>{test.is_active ? "Yes" : "No"}</td>
      <td>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <button
            className="primary-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onEdit}
          >
            Edit
          </button>
          {(test.test_type === "multiple_choice" || test.test_type === "practical") && onManageQuestions && (
            <button
              className="primary-btn"
              style={{ padding: "6px 10px", fontSize: 12, backgroundColor: '#6b8cae', whiteSpace: "nowrap" }}
              onClick={onManageQuestions}
            >
              More
            </button>
          )}
          <button
            className="ghost-btn"
            style={{ padding: "6px 10px", fontSize: 12, whiteSpace: "nowrap" }}
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};

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
  pdf_names: string[] | null;
  section_id: string | null;
  prerequisite_units: number[];
  prerequisite_tests: string[];
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
  needs_proctor: boolean;
  duration: number;
  price_of_schedule: number | null; // Stored in cents (e.g., 4999 = $49.99)
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
  const [showQuestionsManager, setShowQuestionsManager] = useState(false);
  const [managingTest, setManagingTest] = useState<CourseTest | null>(null);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [editingUnit, setEditingUnit] = useState<CourseUnit | null>(null);
  const [editingTest, setEditingTest] = useState<CourseTest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pendingPdfName, setPendingPdfName] = useState<string>("");
  const [currentPdfUrls, setCurrentPdfUrls] = useState<string[]>([]);
  const [currentPdfNames, setCurrentPdfNames] = useState<string[]>([]);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [allCourses, setAllCourses] = useState<TrainingCourse[]>([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingItem, setMovingItem] = useState<{ type: 'unit' | 'test'; item: CourseUnit | CourseTest } | null>(null);
  const [targetCourseId, setTargetCourseId] = useState<string>("");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");

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
    prerequisite_units: [] as number[],
    prerequisite_tests: [] as string[],
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
    needs_proctor: false,
    duration: 60,
    price_of_schedule: null as number | null,
  });

  useEffect(() => {
    if (courseId) {
      loadData();
      loadAllCourses();
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

  const loadAllCourses = async () => {
    try {
      const { data, error: coursesError } = await supabaseClient
        .from("training_courses")
        .select("id, title, provider")
        .eq("provider", "Buzz")
        .order("title", { ascending: true });

      if (coursesError) throw coursesError;
      setAllCourses(data || []);
    } catch (err: any) {
      console.error("Error loading courses:", err);
    }
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
        prerequisite_units: unit.prerequisite_units || [],
        prerequisite_tests: unit.prerequisite_tests || [],
      });
      // Set current PDF URLs if exists (pdf_url is an array)
      const pdfUrls = Array.isArray(unit.pdf_url) ? unit.pdf_url : (unit.pdf_url ? [unit.pdf_url] : []);
      setCurrentPdfUrls(pdfUrls);
      // Set PDF names - use existing names or generate defaults
      const pdfNames = Array.isArray(unit.pdf_names) 
        ? unit.pdf_names 
        : pdfUrls.map((_, i) => `Material ${i + 1}`);
      setCurrentPdfNames(pdfNames);
      setPdfFile(null);
      setPendingPdfName("");
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
        prerequisite_units: [],
        prerequisite_tests: [],
      });
      setCurrentPdfUrls([]);
      setCurrentPdfNames([]);
      setPdfFile(null);
      setPendingPdfName("");
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
      prerequisite_units: [],
      prerequisite_tests: [],
    });
    setPdfFile(null);
    setPendingPdfName("");
    setCurrentPdfUrls([]);
    setCurrentPdfNames([]);
    setError(null);
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (accept PDFs and common image formats)
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
      ];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid PDF or image file (JPEG, PNG, GIF, WebP, BMP, SVG)');
        return;
      }
      
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setPdfFile(file);
      // Pre-fill the name with filename (without extension)
      const nameWithoutExt = file.name.replace(/\.(pdf|jpe?g|png|gif|webp|bmp|svg)$/i, '');
      setPendingPdfName(nameWithoutExt);
      setError(null);
    }
  };

  const removePdf = () => {
    setPdfFile(null);
    setPendingPdfName("");
  };

  const removeExistingPdf = (index: number) => {
    setCurrentPdfUrls(prev => prev.filter((_, i) => i !== index));
    setCurrentPdfNames(prev => prev.filter((_, i) => i !== index));
  };

  const updatePdfName = (index: number, newName: string) => {
    setCurrentPdfNames(prev => {
      const updated = [...prev];
      updated[index] = newName;
      return updated;
    });
  };

  const movePdf = useCallback((dragIndex: number, hoverIndex: number) => {
    setCurrentPdfUrls(prev => {
      const updated = [...prev];
      const [draggedUrl] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedUrl);
      return updated;
    });
    setCurrentPdfNames(prev => {
      const updated = [...prev];
      const [draggedName] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedName);
      return updated;
    });
  }, []);

  const moveSection = useCallback(async (dragIndex: number, hoverIndex: number) => {
    setSections(prev => {
      const updated = [...prev];
      const [draggedSection] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedSection);
      
      // Update display_order for all sections
      const reordered = updated.map((section, index) => ({
        ...section,
        display_order: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(section =>
          supabaseClient
            .from("course_sections")
            .update({ display_order: section.display_order, updated_at: new Date().toISOString() })
            .eq("id", section.id)
        )
      ).catch(err => {
        console.error("Error updating section order:", err);
        setError("Failed to update section order");
      });
      
      return reordered;
    });
  }, []);

  const moveUnit = useCallback(async (dragIndex: number, hoverIndex: number) => {
    setUnits(prev => {
      const updated = [...prev];
      const [draggedUnit] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedUnit);
      
      // Update order_index for all units
      const reordered = updated.map((unit, index) => ({
        ...unit,
        order_index: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(unit =>
          supabaseClient
            .from("course_units")
            .update({ order_index: unit.order_index, updated_at: new Date().toISOString() })
            .eq("id", unit.id)
        )
      ).catch(err => {
        console.error("Error updating unit order:", err);
        setError("Failed to update unit order");
      });
      
      return reordered;
    });
  }, []);

  const moveTest = useCallback(async (dragIndex: number, hoverIndex: number) => {
    setTests(prev => {
      const updated = [...prev];
      const [draggedTest] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedTest);
      
      // Update order_index for all tests
      const reordered = updated.map((test, index) => ({
        ...test,
        order_index: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(test =>
          supabaseClient
            .from("course_tests")
            .update({ order_index: test.order_index, updated_at: new Date().toISOString() })
            .eq("id", test.id)
        )
      ).catch(err => {
        console.error("Error updating test order:", err);
        setError("Failed to update test order");
      });
      
      return reordered;
    });
  }, []);

  const togglePrerequisiteUnit = (unitNumber: number) => {
    setUnitForm(prev => ({
      ...prev,
      prerequisite_units: prev.prerequisite_units.includes(unitNumber)
        ? prev.prerequisite_units.filter(u => u !== unitNumber)
        : [...prev.prerequisite_units, unitNumber].sort((a, b) => a - b)
    }));
  };

  const togglePrerequisiteTest = (testId: string) => {
    setUnitForm(prev => ({
      ...prev,
      prerequisite_tests: prev.prerequisite_tests.includes(testId)
        ? prev.prerequisite_tests.filter(t => t !== testId)
        : [...prev.prerequisite_tests, testId]
    }));
  };

  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    try {
      let pdfUrls: string[] = [...currentPdfUrls];
      let pdfNames: string[] = [...currentPdfNames];

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

          // Add the new PDF to the arrays
          pdfUrls.push(publicUrlData.publicUrl);
          pdfNames.push(pendingPdfName || `Material ${pdfUrls.length}`);
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload material: ${uploadError.message}`);
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
        pdf_url: pdfUrls.length > 0 ? pdfUrls : null,
        pdf_names: pdfNames.length > 0 ? pdfNames : null,
        prerequisite_units: unitForm.prerequisite_units,
        prerequisite_tests: unitForm.prerequisite_tests,
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

  const handleDuplicateUnit = async (unit: CourseUnit) => {
    if (!confirm(`Are you sure you want to duplicate "${unit.title}"?`)) return;

    try {
      setSubmitting(true);
      setError(null);

      // Create a copy of the unit
      const nextUnitNumber = Math.max(...units.map(u => u.unit_number), 0) + 1;
      const nextOrderIndex = Math.max(...units.map(u => u.order_index), 0) + 1;
      
      const duplicatedUnit = {
        course_id: unit.course_id,
        unit_number: nextUnitNumber,
        title: `UNIT ${nextUnitNumber} - ${stripUnitPrefix(unit.title)} (Copy)`,
        description: unit.description,
        content: unit.content,
        is_mandatory: unit.is_mandatory,
        order_index: nextOrderIndex,
        section_id: unit.section_id,
        pdf_url: unit.pdf_url,
        pdf_names: unit.pdf_names,
        prerequisite_units: unit.prerequisite_units,
        prerequisite_tests: unit.prerequisite_tests,
      };

      const { error: insertError } = await supabaseClient
        .from("course_units")
        .insert(duplicatedUnit);

      if (insertError) throw insertError;

      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error duplicating unit:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleMoveUnit = (unit: CourseUnit) => {
    setMovingItem({ type: 'unit', item: unit });
    setTargetCourseId("");
    setCourseSearchQuery("");
    setShowMoveModal(true);
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return "Unassigned";
    const section = sections.find(s => s.id === sectionId);
    return section?.name || "Unknown";
  };

  const getTestName = (testId: string) => {
    const test = tests.find(t => t.id === testId);
    return test?.test_name || "Unknown Test";
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
        needs_proctor: test.needs_proctor || false,
        duration: test.duration || 60,
        price_of_schedule: test.price_of_schedule ?? null,
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
        needs_proctor: false,
        duration: 60,
        price_of_schedule: null,
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
      needs_proctor: false,
      duration: 60,
      price_of_schedule: null,
    });
    setError(null);
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    
    setSubmitting(true);
    setError(null);

    // Validate that price_of_schedule is provided when needs_proctor is checked
    if (testForm.needs_proctor && (testForm.price_of_schedule === null || testForm.price_of_schedule === undefined)) {
      setError("Price of Schedule (USD) is required when Needs proctor is checked.");
      setSubmitting(false);
      return;
    }

    // Validate price range (stored in cents: 0 to 50000 cents = $0 to $500)
    if (testForm.needs_proctor && testForm.price_of_schedule !== null && (testForm.price_of_schedule < 0 || testForm.price_of_schedule > 50000)) {
      setError("Price of Schedule must be between $0.00 and $500.00 USD.");
      setSubmitting(false);
      return;
    }

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
        needs_proctor: testForm.needs_proctor,
        duration: testForm.duration,
        price_of_schedule: testForm.needs_proctor ? (testForm.price_of_schedule ?? null) : null,
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

  const handleDuplicateTest = async (test: CourseTest) => {
    if (!confirm(`Are you sure you want to duplicate "${test.test_name}"? This will copy the test including all questions, answers, criteria, and graphs.`)) return;

    try {
      setSubmitting(true);
      setError(null);

      // Create a copy of the test
      const nextOrderIndex = Math.max(...tests.map(t => t.order_index), 0) + 1;
      
      const duplicatedTest = {
        course_id: test.course_id,
        test_name: `${test.test_name} (Copy)`,
        test_description: test.test_description,
        test_type: test.test_type,
        passing_score: test.passing_score,
        required_for_progression: test.required_for_progression,
        required_units: test.required_units,
        order_index: nextOrderIndex,
        questions: test.questions, // Legacy JSON questions
        is_active: false, // Start as inactive
        section_id: test.section_id,
        needs_proctor: test.needs_proctor,
        duration: test.duration || 60,
        price_of_schedule: test.price_of_schedule ?? null,
      };

      const { data: newTest, error: insertError } = await supabaseClient
        .from("course_tests")
        .insert(duplicatedTest)
        .select()
        .single();

      if (insertError) throw insertError;

      // Duplicate test_questions if they exist (for multiple_choice and practical tests)
      const { data: originalQuestions, error: questionsError } = await supabaseClient
        .from("test_questions")
        .select("*")
        .eq("test_id", test.id)
        .order("question_number", { ascending: true });

      if (questionsError) throw questionsError;

      if (originalQuestions && originalQuestions.length > 0) {
        const duplicatedQuestions = originalQuestions.map(q => ({
          test_id: newTest.id,
          question_number: q.question_number,
          question_area: q.question_area,
          question_text: q.question_text,
          options: q.options,
          correct_answer_index: q.correct_answer_index,
          explanation: q.explanation,
          image_urls: q.image_urls,
          problem_sets: q.problem_sets,
        }));

        const { error: insertQuestionsError } = await supabaseClient
          .from("test_questions")
          .insert(duplicatedQuestions);

        if (insertQuestionsError) throw insertQuestionsError;

        // Update question_source to 'database' for the new test
        await supabaseClient
          .from("course_tests")
          .update({ question_source: 'database' })
          .eq("id", newTest.id);
      }

      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error duplicating test:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const handleMoveTest = (test: CourseTest) => {
    setMovingItem({ type: 'test', item: test });
    setTargetCourseId("");
    setCourseSearchQuery("");
    setShowMoveModal(true);
  };

  const toggleUnitSelection = (unitNumber: number) => {
    setTestForm(prev => ({
      ...prev,
      required_units: prev.required_units.includes(unitNumber)
        ? prev.required_units.filter(u => u !== unitNumber)
        : [...prev.required_units, unitNumber].sort((a, b) => a - b)
    }));
  };

  const handleConfirmMove = async () => {
    if (!movingItem || !targetCourseId) {
      setError("Please select a target course");
      return;
    }

    if (targetCourseId === courseId) {
      setError("Target course must be different from the current course");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (movingItem.type === 'unit') {
        const unit = movingItem.item as CourseUnit;
        
        // Get the max order_index in the target course for units
        const { data: targetUnits, error: fetchError } = await supabaseClient
          .from("course_units")
          .select("order_index, unit_number")
          .eq("course_id", targetCourseId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const nextOrderIndex = targetUnits && targetUnits.length > 0 ? targetUnits[0].order_index + 1 : 1;
        const nextUnitNumber = targetUnits && targetUnits.length > 0 ? targetUnits[0].unit_number + 1 : 1;
        
        // Update the unit's course_id with new order_index
        const { error: updateError } = await supabaseClient
          .from("course_units")
          .update({ 
            course_id: targetCourseId,
            section_id: null, // Clear section since it belongs to the old course
            order_index: nextOrderIndex,
            unit_number: nextUnitNumber,
            updated_at: new Date().toISOString(),
          })
          .eq("id", unit.id);

        if (updateError) throw updateError;
      } else if (movingItem.type === 'test') {
        const test = movingItem.item as CourseTest;
        
        // Get the max order_index in the target course for tests
        const { data: targetTests, error: fetchError } = await supabaseClient
          .from("course_tests")
          .select("order_index")
          .eq("course_id", targetCourseId)
          .order("order_index", { ascending: false })
          .limit(1);

        if (fetchError) throw fetchError;

        const nextOrderIndex = targetTests && targetTests.length > 0 ? targetTests[0].order_index + 1 : 1;
        
        // Update the test's course_id with new order_index
        const { error: updateError } = await supabaseClient
          .from("course_tests")
          .update({ 
            course_id: targetCourseId,
            section_id: null, // Clear section since it belongs to the old course
            order_index: nextOrderIndex,
            updated_at: new Date().toISOString(),
          })
          .eq("id", test.id);

        if (updateError) throw updateError;
      }

      setShowMoveModal(false);
      setMovingItem(null);
      setTargetCourseId("");
      setCourseSearchQuery("");
      await loadData();
      setSubmitting(false);
    } catch (err: any) {
      console.error("Error moving item:", err);
      setError(err.message);
      setSubmitting(false);
    }
  };

  const closeMoveModal = () => {
    setShowMoveModal(false);
    setMovingItem(null);
    setTargetCourseId("");
    setCourseSearchQuery("");
    setError(null);
  };

  const filteredCourses = allCourses.filter(c => 
    c.id !== courseId && 
    c.title.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

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
          <p style={{ color: "#9ca3b5", marginTop: 8 }}>
            {course.title} ({course.id})
          </p>
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
          <DndProvider backend={HTML5Backend}>
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
                {sections.map((section, index) => (
                  <DraggableSectionItem
                    key={section.id}
                    section={section}
                    index={index}
                    unitsCount={units.filter(u => u.section_id === section.id).length}
                    onEdit={() => openSectionForm(section)}
                    onDelete={() => handleDeleteSection(section.id)}
                    onMove={moveSection}
                  />
                ))}
              </tbody>
            </table>
          </DndProvider>
        )}
      </div>

      {/* Units Section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Units</h2>
          <button className="primary-btn" onClick={() => openUnitForm()}>
            + New Unit
          </button>
        </div>

        {units.length === 0 ? (
          <p style={{ color: "#9ca3b5" }}>No units yet.</p>
        ) : (
          <DndProvider backend={HTML5Backend}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Title</th>
                  <th>Section</th>
                  <th>Prerequisites</th>
                  <th>Mandatory</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit, index) => {
                  const prereqs = [];
                  if (unit.prerequisite_units && unit.prerequisite_units.length > 0) {
                    prereqs.push(`Units: ${unit.prerequisite_units.sort((a, b) => a - b).join(", ")}`);
                  }
                  if (unit.prerequisite_tests && unit.prerequisite_tests.length > 0) {
                    const testNames = unit.prerequisite_tests.map(id => getTestName(id)).join(", ");
                    prereqs.push(`Tests: ${testNames}`);
                  }
                  const prerequisitesText = prereqs.length > 0 ? prereqs.join(" | ") : "None";
                  
                  // Check if this is the first unit in a new section
                  const isFirstInSection = index === 0 || units[index - 1].section_id !== unit.section_id;
                  
                  // Assign alternating colors to different sections
                  const sectionIndex = sections.findIndex(s => s.id === unit.section_id);
                  const sectionColor = sectionIndex % 2 === 0 
                    ? 'rgba(107, 140, 174, 0.05)' 
                    : 'rgba(107, 140, 174, 0.02)';
                  
                  return (
                    <DraggableUnitItem
                      key={unit.id}
                      unit={unit}
                      index={index}
                      sectionName={getSectionName(unit.section_id)}
                      prerequisitesText={prerequisitesText}
                      onEdit={() => openUnitForm(unit)}
                      onDelete={() => handleDeleteUnit(unit.id)}
                      onMove={moveUnit}
                      stripUnitPrefix={stripUnitPrefix}
                      isFirstInSection={isFirstInSection}
                      sectionColor={sectionColor}
                    />
                  );
                })}
              </tbody>
            </table>
          </DndProvider>
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
          <DndProvider backend={HTML5Backend}>
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
                  <th>Proctor</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test, index) => (
                  <DraggableTestItem
                    key={test.id}
                    test={test}
                    index={index}
                    sectionName={getSectionName(test.section_id)}
                    onEdit={() => openTestForm(test)}
                    onDelete={() => handleDeleteTest(test.id)}
                    onMove={moveTest}
                    onManageQuestions={(test.test_type === "multiple_choice" || test.test_type === "practical") ? () => {
                      setManagingTest(test);
                      setShowQuestionsManager(true);
                    } : undefined}
                  />
                ))}
              </tbody>
            </table>
          </DndProvider>
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

              <label className="input-label">Unit Materials (PDFs & Images)</label>
              <div style={{ marginBottom: 16 }}>
                {/* Display existing materials with drag-and-drop */}
                {currentPdfUrls.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: '14px', color: '#9ca3b5', marginBottom: 8 }}>
                      Current materials (drag to reorder):
                    </p>
                    <DndProvider backend={HTML5Backend}>
                      {currentPdfUrls.map((pdfUrl, index) => (
                        <DraggablePDFItem
                          key={`${pdfUrl}-${index}`}
                          index={index}
                          url={pdfUrl}
                          name={currentPdfNames[index] || `PDF ${index + 1}`}
                          onNameChange={updatePdfName}
                          onRemove={removeExistingPdf}
                          onMove={movePdf}
                        />
                      ))}
                    </DndProvider>
                  </div>
                )}

                {/* New PDF upload */}
                {pdfFile ? (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'rgba(107, 140, 174, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(107, 140, 174, 0.3)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      <div>
                        <label style={{ fontSize: '12px', color: '#9ca3b5', display: 'block', marginBottom: '4px' }}>
                          Display Name:
                        </label>
                        <input
                          type="text"
                          value={pendingPdfName}
                          onChange={(e) => setPendingPdfName(e.target.value)}
                          className="text-input"
                          style={{ width: '100%', padding: '8px 12px' }}
                          placeholder="Enter a name for this material"
                        />
                      </div>
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
                      Click to upload PDF or image material
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                      PDF or images (JPEG, PNG, GIF, WebP, BMP, SVG) - max 10MB
                    </p>
                  </div>
                )}
                <input
                  id="pdf-upload-input"
                  type="file"
                  accept="application/pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/svg+xml"
                  onChange={handlePdfFileChange}
                  style={{ display: 'none' }}
                />
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

              <label className="input-label">Prerequisite Units</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  marginBottom: "16px"
                }}
              >
                {units.length === 0 || (editingUnit && units.length === 1) ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No other units available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {units
                      .filter(u => !editingUnit || u.unit_number !== editingUnit.unit_number)
                      .map((unit) => (
                        <label 
                          key={unit.id} 
                          style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: 8,
                            padding: "8px",
                            backgroundColor: unitForm.prerequisite_units.includes(unit.unit_number) 
                              ? "rgba(107, 140, 174, 0.2)" 
                              : "transparent",
                            borderRadius: "4px",
                            cursor: "pointer"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={unitForm.prerequisite_units.includes(unit.unit_number)}
                            onChange={() => togglePrerequisiteUnit(unit.unit_number)}
                          />
                          <span>Unit {unit.unit_number}: {stripUnitPrefix(unit.title)}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>

              <label className="input-label">Prerequisite Tests</label>
              <div 
                style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto", 
                  border: "1px solid rgba(255, 255, 255, 0.2)", 
                  borderRadius: "8px", 
                  padding: "12px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  marginBottom: "16px"
                }}
              >
                {tests.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0 }}>No tests available</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {tests.map((test) => (
                      <label 
                        key={test.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8,
                          padding: "8px",
                          backgroundColor: unitForm.prerequisite_tests.includes(test.id) 
                            ? "rgba(107, 140, 174, 0.2)" 
                            : "transparent",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={unitForm.prerequisite_tests.includes(test.id)}
                          onChange={() => togglePrerequisiteTest(test.id)}
                        />
                        <span>{test.test_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
                <input
                  type="checkbox"
                  name="is_mandatory"
                  checked={unitForm.is_mandatory}
                  onChange={(e) => setUnitForm({ ...unitForm, is_mandatory: e.target.checked })}
                />
                <span>Mandatory unit</span>
              </label>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="primary-btn" disabled={submitting || uploadingPdf}>
                  {uploadingPdf
                    ? "Uploading Material..."
                    : submitting
                    ? "Saving..."
                    : editingUnit
                    ? "Update Unit"
                    : "Create Unit"}
                </button>
                {editingUnit && (
                  <>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ backgroundColor: '#6b8cae' }}
                      onClick={() => {
                        closeUnitForm();
                        handleDuplicateUnit(editingUnit);
                      }}
                      disabled={submitting || uploadingPdf}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        closeUnitForm();
                        handleMoveUnit(editingUnit);
                      }}
                      disabled={submitting || uploadingPdf}
                    >
                      Move to
                    </button>
                  </>
                )}
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

              <label className="input-label">Duration (minutes)</label>
              <input
                name="duration"
                type="number"
                value={testForm.duration}
                onChange={(e) => setTestForm({ ...testForm, duration: parseInt(e.target.value) || 60 })}
                className="text-input"
                placeholder="60"
                min="1"
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

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    name="needs_proctor"
                    checked={testForm.needs_proctor}
                    onChange={(e) => setTestForm({ 
                      ...testForm, 
                      needs_proctor: e.target.checked,
                      price_of_schedule: e.target.checked ? testForm.price_of_schedule : null
                    })}
                  />
                  <span>Needs proctor</span>
                </label>
              </div>

              {testForm.needs_proctor && (
                <div style={{ marginTop: 16 }}>
                  <label className="input-label">Price of Schedule (USD) *</label>
                  <div style={{ fontSize: '12px', color: '#9ca3b5', marginBottom: 4 }}>
                    Enter amount in dollars (e.g., 49.99). Maximum $500.00
                  </div>
                  <input
                    name="price_of_schedule"
                    type="number"
                    value={testForm.price_of_schedule !== null ? (testForm.price_of_schedule / 100).toFixed(2) : ""}
                    onChange={(e) => {
                      const value = e.target.value === "" ? null : Math.round(parseFloat(e.target.value) * 100);
                      setTestForm({ ...testForm, price_of_schedule: value });
                    }}
                    className="text-input"
                    placeholder="49.99"
                    min="0"
                    max="500"
                    step="0.01"
                    required
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Saving..." : editingTest ? "Update Test" : "Create Test"}
                </button>
                {editingTest && (
                  <>
                    <button
                      type="button"
                      className="primary-btn"
                      style={{ backgroundColor: '#6b8cae' }}
                      onClick={() => {
                        closeTestForm();
                        handleDuplicateTest(editingTest);
                      }}
                      disabled={submitting}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => {
                        closeTestForm();
                        handleMoveTest(editingTest);
                      }}
                      disabled={submitting}
                    >
                      Move to
                    </button>
                  </>
                )}
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

      {/* Test Questions Manager Modal */}
      {showQuestionsManager && managingTest && (
        managingTest.test_type === "multiple_choice" ? (
          <TestQuestionsManager
            testId={managingTest.id}
            testName={managingTest.test_name}
            onClose={() => {
              setShowQuestionsManager(false);
              setManagingTest(null);
            }}
          />
        ) : managingTest.test_type === "practical" ? (
          <PracticalTestCriteriaManager
            testId={managingTest.id}
            testName={managingTest.test_name}
            onClose={() => {
              setShowQuestionsManager(false);
              setManagingTest(null);
            }}
          />
        ) : null
      )}

      {/* Move To Modal */}
      {showMoveModal && movingItem && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Move {movingItem.type === 'unit' ? 'Unit' : 'Test'} to Another Course
              </h3>
              <button className="ghost-btn" onClick={closeMoveModal}>
                Close
              </button>
            </div>

            {error && <div className="alert error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#9ca3b5", marginBottom: 12 }}>
                Moving: <strong>
                  {movingItem.type === 'unit' 
                    ? (movingItem.item as CourseUnit).title 
                    : (movingItem.item as CourseTest).test_name}
                </strong>
              </p>
              <p style={{ color: "#9ca3b5", fontSize: 14 }}>
                Note: The {movingItem.type} will be moved to the target course and its section assignment will be cleared.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="input-label">Search for Course</label>
              <input
                type="text"
                value={courseSearchQuery}
                onChange={(e) => setCourseSearchQuery(e.target.value)}
                className="text-input"
                placeholder="Type to search courses..."
                style={{ marginBottom: 12 }}
              />

              <label className="input-label">Select Target Course *</label>
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                }}
              >
                {filteredCourses.length === 0 ? (
                  <p style={{ color: "#9ca3b5", margin: 0, padding: "12px", textAlign: "center" }}>
                    {courseSearchQuery ? "No courses found matching your search" : "No other Buzz courses available"}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredCourses.map((course) => (
                      <label
                        key={course.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "12px",
                          backgroundColor: targetCourseId === course.id
                            ? "rgba(107, 140, 174, 0.3)"
                            : "rgba(255, 255, 255, 0.05)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          if (targetCourseId !== course.id) {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (targetCourseId !== course.id) {
                            e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="targetCourse"
                          checked={targetCourseId === course.id}
                          onChange={() => setTargetCourseId(course.id)}
                          style={{ flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>{course.title}</div>
                          <div style={{ fontSize: 12, color: "#9ca3b5" }}>ID: {course.id}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="primary-btn"
                onClick={handleConfirmMove}
                disabled={submitting || !targetCourseId}
              >
                {submitting ? "Moving..." : "Confirm Move"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={closeMoveModal}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
