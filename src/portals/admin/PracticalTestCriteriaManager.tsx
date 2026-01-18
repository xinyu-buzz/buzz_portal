import { useEffect, useState, useCallback, useRef } from "react";
import { supabaseClient } from "../../utility";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const CRITERIA_ITEM_TYPE = "CRITERIA_ITEM";
const IMAGE_ITEM_TYPE = "IMAGE_ITEM";

type TestCriteria = {
  id: string;
  test_id: string;
  question_number: number;
  question_area: string | null;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
  image_urls: string[];
  problem_sets: number[] | null;
  created_at: string;
  updated_at: string;
};

type PracticalTestCriteriaManagerProps = {
  testId: string;
  testName: string;
  onClose: () => void;
};

type DraggableCriteriaItemProps = {
  criteria: TestCriteria;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggableCriteriaItem = ({ criteria, index, onEdit, onDelete, onMove }: DraggableCriteriaItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: CRITERIA_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: CRITERIA_ITEM_TYPE,
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

  // Determine result (Pass/Fail based on correct_answer_index: 0=Pass, 1=Fail)
  const result = criteria.correct_answer_index === 0 ? "Pass" : "Fail";

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
          <span>{criteria.question_number}</span>
        </div>
      </td>
      <td>{criteria.question_area || "—"}</td>
      <td style={{ maxWidth: '400px' }}>
        <div style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {criteria.question_text}
        </div>
      </td>
      <td>
        <span style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          backgroundColor: result === 'Pass' ? 'rgba(74, 124, 89, 0.3)' : 'rgba(220, 38, 38, 0.3)',
          color: result === 'Pass' ? '#a7f3d0' : '#fca5a5'
        }}>
          {result}
        </span>
      </td>
      <td>{criteria.image_urls?.length || 0}</td>
      <td>
        {criteria.problem_sets && criteria.problem_sets.length > 0
          ? criteria.problem_sets.sort((a, b) => a - b).join(', ')
          : '—'}
      </td>
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

type DraggableImageItemProps = {
  index: number;
  url: string;
  onRemove: (index: number) => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
  onPreview: (url: string) => void;
};

const DraggableImageItem = ({ index, url, onRemove, onMove, onPreview }: DraggableImageItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: IMAGE_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: IMAGE_ITEM_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

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
        position: 'relative',
        width: '120px',
        height: '120px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '2px solid rgba(107, 140, 174, 0.3)',
        backgroundColor: 'rgba(107, 140, 174, 0.1)',
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transition: 'all 0.2s',
        boxShadow: isOver ? '0 0 10px rgba(107, 140, 174, 0.5)' : 'none',
      }}
    >
      <img
        src={url}
        alt={`Criteria image ${index + 1}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          cursor: 'pointer',
        }}
        onClick={() => onPreview(url)}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(index);
        }}
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          backgroundColor: 'rgba(220, 38, 38, 0.9)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
};

export const PracticalTestCriteriaManager = ({ testId, testName, onClose }: PracticalTestCriteriaManagerProps) => {
  const [criteria, setCriteria] = useState<TestCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCriteriaForm, setShowCriteriaForm] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<TestCriteria | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [filterProblemSet, setFilterProblemSet] = useState<number | 'all'>('all');

  // Filter criteria based on selected problem set
  const filteredCriteria = filterProblemSet === 'all' 
    ? criteria 
    : criteria.filter(c => c.problem_sets && c.problem_sets.includes(filterProblemSet as number));

  // Get unique problem sets from all criteria for filter dropdown
  const availableProblemSets = Array.from(
    new Set(
      criteria.flatMap(c => c.problem_sets || [])
    )
  ).sort((a, b) => a - b);

  const [criteriaForm, setCriteriaForm] = useState({
    question_number: 0,
    question_area: "",
    question_text: "",
    correct_answer_index: 0, // 0 = Pass, 1 = Fail
    explanation: "",
    problem_sets: [] as number[],
  });

  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);

  useEffect(() => {
    loadCriteria();
  }, [testId]);

  const loadCriteria = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseClient
        .from("test_questions")
        .select("*")
        .eq("test_id", testId)
        .order("question_number", { ascending: true });

      if (fetchError) throw fetchError;
      setCriteria(data || []);
    } catch (err: any) {
      console.error("Error loading criteria:", err);
      setError(err.message);
    }

    setLoading(false);
  };

  const openCriteriaForm = (criteriaItem?: TestCriteria) => {
    if (criteriaItem) {
      setEditingCriteria(criteriaItem);
      setCriteriaForm({
        question_number: criteriaItem.question_number,
        question_area: criteriaItem.question_area || "",
        question_text: criteriaItem.question_text,
        correct_answer_index: criteriaItem.correct_answer_index,
        explanation: criteriaItem.explanation || "",
        problem_sets: criteriaItem.problem_sets || [],
      });
      setCurrentImageUrls(criteriaItem.image_urls || []);
    } else {
      setEditingCriteria(null);
      const nextNumber = criteria.length > 0 
        ? Math.max(...criteria.map(c => c.question_number)) + 1 
        : 1;
      setCriteriaForm({
        question_number: nextNumber,
        question_area: "",
        question_text: "",
        correct_answer_index: 0, // Default to Pass
        explanation: "",
        problem_sets: [],
      });
      setCurrentImageUrls([]);
    }
    setPendingImageFiles([]);
    setShowCriteriaForm(true);
  };

  const closeCriteriaForm = () => {
    setShowCriteriaForm(false);
    setEditingCriteria(null);
    setCriteriaForm({
      question_number: 0,
      question_area: "",
      question_text: "",
      correct_answer_index: 0,
      explanation: "",
      problem_sets: [],
    });
    setCurrentImageUrls([]);
    setPendingImageFiles([]);
    setError(null);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles: File[] = [];
    for (const file of files) {
      if (!file.type.match(/^image\/(png|jpe?g)$/)) {
        setError('Please select only PNG or JPEG images');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setPendingImageFiles(prev => [...prev, ...validFiles]);
      setError(null);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setCurrentImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const moveImage = useCallback((dragIndex: number, hoverIndex: number) => {
    setCurrentImageUrls(prev => {
      const updated = [...prev];
      const [draggedUrl] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedUrl);
      return updated;
    });
  }, []);

  const moveCriteria = useCallback(async (dragIndex: number, hoverIndex: number) => {
    const currentList = filterProblemSet === 'all' ? criteria : filteredCriteria;
    
    setCriteria(prev => {
      const draggedCriteria = currentList[dragIndex];
      const hoverCriteria = currentList[hoverIndex];
      
      const actualDragIndex = prev.findIndex(c => c.id === draggedCriteria.id);
      const actualHoverIndex = prev.findIndex(c => c.id === hoverCriteria.id);
      
      const updated = [...prev];
      const [removed] = updated.splice(actualDragIndex, 1);
      updated.splice(actualHoverIndex, 0, removed);
      
      // Update question_number for all criteria
      const reordered = updated.map((criteriaItem, index) => ({
        ...criteriaItem,
        question_number: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(criteriaItem =>
          supabaseClient
            .from("test_questions")
            .update({ question_number: criteriaItem.question_number, updated_at: new Date().toISOString() })
            .eq("id", criteriaItem.id)
        )
      ).catch(err => {
        console.error("Error updating criteria order:", err);
        setError("Failed to update criteria order");
      });
      
      return reordered;
    });
  }, [filterProblemSet, criteria, filteredCriteria]);

  const handleCriteriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let imageUrls = [...currentImageUrls];

      // Upload pending images
      if (pendingImageFiles.length > 0) {
        setUploadingImages(true);
        try {
          for (const file of pendingImageFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `image-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `test-${testId}/criteria-${criteriaForm.question_number}/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
              .from('course-materials')
              .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabaseClient.storage
              .from('course-materials')
              .getPublicUrl(filePath);

            imageUrls.push(publicUrlData.publicUrl);
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setError(`Failed to upload images: ${uploadError.message}`);
          setSubmitting(false);
          setUploadingImages(false);
          return;
        }
        setUploadingImages(false);
      }

      // Store as options array with Pass/Fail
      const options = ["Pass", "Fail"];

      const payload: any = {
        test_id: testId,
        question_number: criteriaForm.question_number,
        question_area: criteriaForm.question_area || null,
        question_text: criteriaForm.question_text,
        options: options,
        correct_answer_index: criteriaForm.correct_answer_index,
        explanation: criteriaForm.explanation || null,
        image_urls: imageUrls,
        problem_sets: criteriaForm.problem_sets.length > 0 ? criteriaForm.problem_sets : null,
        updated_at: new Date().toISOString(),
      };

      if (editingCriteria) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("test_questions")
          .update(payload)
          .eq("id", editingCriteria.id);

        if (updateError) throw updateError;
      } else {
        // Create
        const { error: insertError } = await supabaseClient
          .from("test_questions")
          .insert(payload);

        if (insertError) throw insertError;
      }

      // Update course_tests.question_source to 'database'
      await supabaseClient
        .from("course_tests")
        .update({ question_source: 'database' })
        .eq("id", testId);

      closeCriteriaForm();
      await loadCriteria();
    } catch (err: any) {
      console.error("Error saving criteria:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteCriteria = async (criteriaId: string) => {
    if (!confirm("Are you sure you want to delete this criteria?")) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from("test_questions")
        .delete()
        .eq("id", criteriaId);

      if (deleteError) throw deleteError;
      await loadCriteria();
    } catch (err: any) {
      console.error("Error deleting criteria:", err);
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card" style={{ maxWidth: 1200 }}>
          <p>Loading criteria...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-backdrop">
        <div className="modal-card" style={{ maxWidth: 1200, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div>
              <h3 style={{ margin: 0 }}>Manage Practical Test Criteria</h3>
              <p style={{ color: "#9ca3b5", fontSize: 14, marginTop: 4 }}>{testName} ({testId})</p>
            </div>
            <button className="ghost-btn" onClick={onClose}>
              Close
            </button>
          </div>

          {error && (
            <div className="alert error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: 'center', marginTop: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="primary-btn" onClick={() => openCriteriaForm()}>
                + Add Criteria
              </button>
            </div>
            
            {availableProblemSets.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                <label style={{ fontSize: '14px', color: '#9ca3b5', whiteSpace: 'nowrap' }}>
                  Filter by Problem Set:
                </label>
                <select
                  value={filterProblemSet}
                  onChange={(e) => setFilterProblemSet(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="text-input"
                  style={{ minWidth: '120px', padding: '8px 12px' }}
                >
                  <option value="all">All Criteria ({criteria.length})</option>
                  {availableProblemSets.map(setNum => {
                    const count = criteria.filter(c => c.problem_sets && c.problem_sets.includes(setNum)).length;
                    return (
                      <option key={setNum} value={setNum}>
                        Set {setNum} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {criteria.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3b5' }}>
                <p>No criteria yet. Click "Add Criteria" to create your first criteria.</p>
              </div>
            ) : filteredCriteria.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3b5' }}>
                <p>No criteria found for the selected problem set.</p>
              </div>
            ) : (
              <DndProvider backend={HTML5Backend}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>No.</th>
                      <th style={{ width: '150px' }}>Area</th>
                      <th>Criteria</th>
                      <th style={{ width: '100px' }}>Result</th>
                      <th style={{ width: '100px' }}>Images</th>
                      <th style={{ width: '120px' }}>Problem Sets</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCriteria.map((criteriaItem, index) => (
                      <DraggableCriteriaItem
                        key={criteriaItem.id}
                        criteria={criteriaItem}
                        index={index}
                        onEdit={() => openCriteriaForm(criteriaItem)}
                        onDelete={() => handleDeleteCriteria(criteriaItem.id)}
                        onMove={moveCriteria}
                      />
                    ))}
                  </tbody>
                </table>
              </DndProvider>
            )}
          </div>
        </div>
      </div>

      {/* Criteria Form Modal */}
      {showCriteriaForm && (
        <div className="modal-backdrop" style={{ zIndex: 1001 }}>
          <div className="modal-card" style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {editingCriteria ? "Edit Criteria" : "Add Criteria"}
              </h3>
              <button className="ghost-btn" onClick={closeCriteriaForm}>
                Close
              </button>
            </div>

            <form className="modal-form" onSubmit={handleCriteriaSubmit}>
              {error && <div className="alert error">{error}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                <div>
                  <label className="input-label">Criteria Number *</label>
                  <input
                    type="number"
                    value={criteriaForm.question_number}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, question_number: parseInt(e.target.value) || 0 })}
                    className="text-input"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Criteria Area/Category</label>
                  <input
                    type="text"
                    value={criteriaForm.question_area}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, question_area: e.target.value })}
                    className="text-input"
                    placeholder="e.g., Pre-flight, Takeoff, Landing"
                  />
                </div>
              </div>

              <label className="input-label">Criteria Description *</label>
              <textarea
                value={criteriaForm.question_text}
                onChange={(e) => setCriteriaForm({ ...criteriaForm, question_text: e.target.value })}
                className="text-input"
                rows={4}
                placeholder="Enter the criteria description"
                required
              />

              <label className="input-label">Expected Result *</label>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="result"
                    checked={criteriaForm.correct_answer_index === 0}
                    onChange={() => setCriteriaForm({ ...criteriaForm, correct_answer_index: 0 })}
                  />
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    backgroundColor: 'rgba(74, 124, 89, 0.3)',
                    color: '#a7f3d0'
                  }}>
                    Pass
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="result"
                    checked={criteriaForm.correct_answer_index === 1}
                    onChange={() => setCriteriaForm({ ...criteriaForm, correct_answer_index: 1 })}
                  />
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    backgroundColor: 'rgba(220, 38, 38, 0.3)',
                    color: '#fca5a5'
                  }}>
                    Fail
                  </span>
                </label>
              </div>

              <label className="input-label">Notes (Optional)</label>
              <textarea
                value={criteriaForm.explanation}
                onChange={(e) => setCriteriaForm({ ...criteriaForm, explanation: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Additional notes or explanation"
              />

              <label className="input-label">Problem Sets (Optional)</label>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '14px', color: '#9ca3b5', marginBottom: 12 }}>
                  Add problem set numbers for this criteria:
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter set number (e.g., 1)"
                    className="text-input"
                    style={{ maxWidth: '200px' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const value = parseInt((e.target as HTMLInputElement).value);
                        if (value && value > 0 && !criteriaForm.problem_sets.includes(value)) {
                          setCriteriaForm({
                            ...criteriaForm,
                            problem_sets: [...criteriaForm.problem_sets, value].sort((a, b) => a - b)
                          });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ghost-btn"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      const value = parseInt(input.value);
                      if (value && value > 0 && !criteriaForm.problem_sets.includes(value)) {
                        setCriteriaForm({
                          ...criteriaForm,
                          problem_sets: [...criteriaForm.problem_sets, value].sort((a, b) => a - b)
                        });
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {criteriaForm.problem_sets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '12px', color: '#9ca3b5', marginBottom: 8 }}>
                      Selected sets:
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {criteriaForm.problem_sets.map(setNum => (
                        <span
                          key={setNum}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: 'rgba(107, 140, 174, 0.3)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          Set {setNum}
                          <button
                            type="button"
                            onClick={() => {
                              setCriteriaForm({
                                ...criteriaForm,
                                problem_sets: criteriaForm.problem_sets.filter(n => n !== setNum)
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: 0,
                              lineHeight: 1
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <label className="input-label">Images/Documents</label>
              <div style={{ marginBottom: 16 }}>
                {/* Display existing images */}
                {currentImageUrls.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: '14px', color: '#9ca3b5', marginBottom: 8 }}>
                      Current Images (drag to reorder):
                    </p>
                    <DndProvider backend={HTML5Backend}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {currentImageUrls.map((url, index) => (
                          <DraggableImageItem
                            key={`${url}-${index}`}
                            index={index}
                            url={url}
                            onRemove={removeExistingImage}
                            onMove={moveImage}
                            onPreview={setPreviewImage}
                          />
                        ))}
                      </div>
                    </DndProvider>
                  </div>
                )}

                {/* Display pending images */}
                {pendingImageFiles.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: '14px', color: '#9ca3b5', marginBottom: 8 }}>
                      New Images to Upload:
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {pendingImageFiles.map((file, index) => (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            width: '120px',
                            height: '120px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '2px dashed rgba(107, 140, 174, 0.5)',
                            backgroundColor: 'rgba(107, 140, 174, 0.1)',
                          }}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Pending ${index + 1}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removePendingImage(index)}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              backgroundColor: 'rgba(220, 38, 38, 0.9)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 'bold',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload button */}
                <div
                  style={{
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('criteria-image-upload')?.click()}
                >
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🖼️</div>
                  <p style={{ color: '#9ca3b5', margin: 0 }}>
                    Click to upload images
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                    PNG or JPEG only (max 5MB each)
                  </p>
                </div>
                <input
                  id="criteria-image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  multiple
                  onChange={handleImageFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={submitting || uploadingImages}>
                  {uploadingImages
                    ? "Uploading Images..."
                    : submitting
                    ? "Saving..."
                    : editingCriteria
                    ? "Update Criteria"
                    : "Create Criteria"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeCriteriaForm}
                  disabled={submitting || uploadingImages}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="modal-backdrop" 
          style={{ zIndex: 1002 }}
          onClick={() => setPreviewImage(null)}
        >
          <div 
            style={{ 
              maxWidth: '90vw', 
              maxHeight: '90vh',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                cursor: 'pointer',
                fontSize: '24px',
                fontWeight: 'bold',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};
