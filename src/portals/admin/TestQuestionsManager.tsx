import { useEffect, useState, useCallback, useRef } from "react";
import { supabaseClient } from "../../utility";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const QUESTION_ITEM_TYPE = "QUESTION_ITEM";
const IMAGE_ITEM_TYPE = "IMAGE_ITEM";

type TestQuestion = {
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

type TestQuestionsManagerProps = {
  testId: string;
  testName: string;
  onClose: () => void;
};

type DraggableQuestionItemProps = {
  question: TestQuestion;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dragIndex: number, hoverIndex: number) => void;
};

const DraggableQuestionItem = ({ question, index, onEdit, onDelete, onMove }: DraggableQuestionItemProps) => {
  const ref = useRef<HTMLTableRowElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: QUESTION_ITEM_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: QUESTION_ITEM_TYPE,
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
          <span>{question.question_number}</span>
        </div>
      </td>
      <td>{question.question_area || "—"}</td>
      <td style={{ maxWidth: '400px' }}>
        <div style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {question.question_text}
        </div>
      </td>
      <td>{question.options.length}</td>
      <td>{question.image_urls?.length || 0}</td>
      <td>
        {question.problem_sets && question.problem_sets.length > 0
          ? question.problem_sets.sort((a, b) => a - b).join(', ')
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
        alt={`Question image ${index + 1}`}
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

export const TestQuestionsManager = ({ testId, testName, onClose }: TestQuestionsManagerProps) => {
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<TestQuestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<TestQuestion[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importing, setImporting] = useState(false);
  const [filterProblemSet, setFilterProblemSet] = useState<number | 'all'>('all');

  // Filter questions based on selected problem set
  const filteredQuestions = filterProblemSet === 'all' 
    ? questions 
    : questions.filter(q => q.problem_sets && q.problem_sets.includes(filterProblemSet as number));

  // Get unique problem sets from all questions for filter dropdown
  const availableProblemSets = Array.from(
    new Set(
      questions.flatMap(q => q.problem_sets || [])
    )
  ).sort((a, b) => a - b);

  const [questionForm, setQuestionForm] = useState({
    question_number: 0,
    question_area: "",
    question_text: "",
    options: ["", "", "", ""],
    correct_answer_index: 0,
    explanation: "",
    problem_sets: [] as number[],
  });

  const [currentImageUrls, setCurrentImageUrls] = useState<string[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);

  useEffect(() => {
    loadQuestions();
  }, [testId]);

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabaseClient
        .from("test_questions")
        .select("*")
        .eq("test_id", testId)
        .order("question_number", { ascending: true });

      if (fetchError) throw fetchError;
      setQuestions(data || []);
    } catch (err: any) {
      console.error("Error loading questions:", err);
      setError(err.message);
    }

    setLoading(false);
  };

  const openQuestionForm = (question?: TestQuestion) => {
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        question_number: question.question_number,
        question_area: question.question_area || "",
        question_text: question.question_text,
        options: question.options,
        correct_answer_index: question.correct_answer_index,
        explanation: question.explanation || "",
        problem_sets: question.problem_sets || [],
      });
      setCurrentImageUrls(question.image_urls || []);
    } else {
      setEditingQuestion(null);
      const nextNumber = questions.length > 0 
        ? Math.max(...questions.map(q => q.question_number)) + 1 
        : 1;
      setQuestionForm({
        question_number: nextNumber,
        question_area: "",
        question_text: "",
        options: ["", "", "", ""],
        correct_answer_index: 0,
        explanation: "",
        problem_sets: [],
      });
      setCurrentImageUrls([]);
    }
    setPendingImageFiles([]);
    setShowQuestionForm(true);
  };

  const closeQuestionForm = () => {
    setShowQuestionForm(false);
    setEditingQuestion(null);
    setQuestionForm({
      question_number: 0,
      question_area: "",
      question_text: "",
      options: ["", "", "", ""],
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

  const moveQuestion = useCallback(async (dragIndex: number, hoverIndex: number) => {
    // When filtering, we need to work with the filtered list for display
    // but update the original questions array
    const currentList = filterProblemSet === 'all' ? questions : filteredQuestions;
    
    setQuestions(prev => {
      // If we're filtering, find the actual indices in the full questions array
      const draggedQuestion = currentList[dragIndex];
      const hoverQuestion = currentList[hoverIndex];
      
      const actualDragIndex = prev.findIndex(q => q.id === draggedQuestion.id);
      const actualHoverIndex = prev.findIndex(q => q.id === hoverQuestion.id);
      
      const updated = [...prev];
      const [removed] = updated.splice(actualDragIndex, 1);
      updated.splice(actualHoverIndex, 0, removed);
      
      // Update question_number for all questions
      const reordered = updated.map((question, index) => ({
        ...question,
        question_number: index + 1,
      }));
      
      // Save to database
      Promise.all(
        reordered.map(question =>
          supabaseClient
            .from("test_questions")
            .update({ question_number: question.question_number, updated_at: new Date().toISOString() })
            .eq("id", question.id)
        )
      ).catch(err => {
        console.error("Error updating question order:", err);
        setError("Failed to update question order");
      });
      
      return reordered;
    });
  }, [filterProblemSet, questions, filteredQuestions]);

  const updateOption = (index: number, value: string) => {
    setQuestionForm(prev => {
      const updated = [...prev.options];
      updated[index] = value;
      return { ...prev, options: updated };
    });
  };

  const addOption = () => {
    setQuestionForm(prev => ({
      ...prev,
      options: [...prev.options, ""]
    }));
  };

  const removeOption = (index: number) => {
    if (questionForm.options.length <= 2) {
      setError("Question must have at least 2 options");
      return;
    }
    setQuestionForm(prev => {
      const updated = prev.options.filter((_, i) => i !== index);
      // Adjust correct answer index if needed
      const newCorrectIndex = prev.correct_answer_index >= index 
        ? Math.max(0, prev.correct_answer_index - 1)
        : prev.correct_answer_index;
      return { 
        ...prev, 
        options: updated,
        correct_answer_index: newCorrectIndex
      };
    });
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
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
            const filePath = `test-${testId}/question-${questionForm.question_number}/${fileName}`;

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

      const payload: any = {
        test_id: testId,
        question_number: questionForm.question_number,
        question_area: questionForm.question_area || null,
        question_text: questionForm.question_text,
        options: questionForm.options.filter(opt => opt.trim() !== ""),
        correct_answer_index: questionForm.correct_answer_index,
        explanation: questionForm.explanation || null,
        image_urls: imageUrls,
        problem_sets: questionForm.problem_sets.length > 0 ? questionForm.problem_sets : null,
        updated_at: new Date().toISOString(),
      };

      if (editingQuestion) {
        // Update
        const { error: updateError } = await supabaseClient
          .from("test_questions")
          .update(payload)
          .eq("id", editingQuestion.id);

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

      closeQuestionForm();
      await loadQuestions();
    } catch (err: any) {
      console.error("Error saving question:", err);
      setError(err.message);
    }

    setSubmitting(false);
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const { error: deleteError } = await supabaseClient
        .from("test_questions")
        .delete()
        .eq("id", questionId);

      if (deleteError) throw deleteError;
      await loadQuestions();
    } catch (err: any) {
      console.error("Error deleting question:", err);
      setError(err.message);
    }
  };

  // Helper function to parse a CSV line properly (handles quoted fields with commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Push last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (csvText: string): TestQuestion[] => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have a header row and at least one data row');
    }

    const headers = parseCSVLine(lines[0]);
    const requiredHeaders = ['problem_number', 'problem_area', 'problem_statement', 'correct_answer'];
    
    for (const header of requiredHeaders) {
      if (!headers.includes(header)) {
        throw new Error(`CSV must include "${header}" column`);
      }
    }

    const parsedQuestions: TestQuestion[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const values = parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Extract options (option_1, option_2, option_3, etc.)
        const options: string[] = [];
        let optionIndex = 1;
        while (row[`option_${optionIndex}`]) {
          options.push(row[`option_${optionIndex}`]);
          optionIndex++;
        }

        if (options.length < 2) {
          throw new Error(`Question ${row.problem_number} must have at least 2 options`);
        }

        const correctAnswerIndex = parseInt(row.correct_answer) - 1; // CSV uses 1-based indexing
        
        if (correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
          throw new Error(`Question ${row.problem_number} has invalid correct_answer value`);
        }

        // Parse problem_sets if present
        let problemSets: number[] | null = null;
        if (row.problem_sets && row.problem_sets.trim()) {
          const setNumbers = row.problem_sets.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n) && n > 0);
          problemSets = setNumbers.length > 0 ? setNumbers : null;
        }

        parsedQuestions.push({
          id: `temp-${i}`, // Temporary ID for preview
          test_id: testId,
          question_number: parseInt(row.problem_number) || i,
          question_area: row.problem_area || null,
          question_text: row.problem_statement,
          options,
          correct_answer_index: correctAnswerIndex,
          explanation: row.explanation || null,
          image_urls: [],
          problem_sets: problemSets,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (err: any) {
        throw new Error(`Error parsing line ${i}: ${err.message}`);
      }
    }

    return parsedQuestions;
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    setCsvFile(file);
    
    // Read and preview the CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const parsed = parseCSV(csvText);
        setCsvPreview(parsed);
        setError(null);
      } catch (err: any) {
        console.error('CSV parse error:', err);
        setError(`Failed to parse CSV: ${err.message}`);
        setCsvFile(null);
        setCsvPreview([]);
      }
    };
    reader.readAsText(file);
  };

  const handleImportCSV = async () => {
    if (!csvFile || csvPreview.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      // If replace mode, delete existing questions
      if (importMode === 'replace') {
        const { error: deleteError } = await supabaseClient
          .from("test_questions")
          .delete()
          .eq("test_id", testId);

        if (deleteError) throw deleteError;
      }

      // Insert new questions
      const questionsToInsert = csvPreview.map(({ id, created_at, updated_at, ...question }) => ({
        ...question,
        test_id: testId,
      }));

      const { error: insertError } = await supabaseClient
        .from("test_questions")
        .insert(questionsToInsert);

      if (insertError) throw insertError;

      // Update course_tests.question_source to 'database'
      await supabaseClient
        .from("course_tests")
        .update({ question_source: 'database' })
        .eq("id", testId);

      // Close import modal and reload
      setShowCSVImport(false);
      setCsvFile(null);
      setCsvPreview([]);
      await loadQuestions();
    } catch (err: any) {
      console.error('Import error:', err);
      setError(`Failed to import questions: ${err.message}`);
    }

    setImporting(false);
  };

  const handleExportCSV = () => {
    if (questions.length === 0) {
      setError('No questions to export');
      return;
    }

    // Build CSV content
    let csvContent = 'problem_number,problem_area,problem_statement,';
    
    // Determine max number of options
    const maxOptions = Math.max(...questions.map(q => q.options.length));
    for (let i = 1; i <= maxOptions; i++) {
      csvContent += `option_${i},`;
    }
    csvContent += 'correct_answer,explanation,problem_sets\n';

    // Add rows
    for (const question of questions) {
      const row = [
        question.question_number,
        question.question_area || '',
        `"${question.question_text.replace(/"/g, '""')}"`,
      ];
      
      // Add options
      for (let i = 0; i < maxOptions; i++) {
        const option = question.options[i] || '';
        row.push(`"${option.replace(/"/g, '""')}"`);
      }
      
      // Add correct answer (1-based index)
      row.push(String(question.correct_answer_index + 1));
      
      // Add explanation
      row.push(`"${(question.explanation || '').replace(/"/g, '""')}"`);
      
      // Add problem_sets
      const problemSets = question.problem_sets && question.problem_sets.length > 0 
        ? question.problem_sets.sort((a, b) => a - b).join(',') 
        : '';
      row.push(`"${problemSets}"`);
      
      csvContent += row.join(',') + '\n';
    }

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${testName.replace(/[^a-z0-9]/gi, '_')}_questions.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="modal-backdrop">
        <div className="modal-card" style={{ maxWidth: 1200 }}>
          <p>Loading questions...</p>
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
              <h3 style={{ margin: 0 }}>Manage Questions</h3>
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
              <button className="primary-btn" onClick={() => openQuestionForm()}>
                + Add Question
              </button>
              <button className="ghost-btn" onClick={() => setShowCSVImport(true)}>
                Import from CSV
              </button>
              <button 
                className="ghost-btn" 
                onClick={handleExportCSV}
                disabled={questions.length === 0}
              >
                Export to CSV
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
                  <option value="all">All Questions ({questions.length})</option>
                  {availableProblemSets.map(setNum => {
                    const count = questions.filter(q => q.problem_sets && q.problem_sets.includes(setNum)).length;
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
            {questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3b5' }}>
                <p>No questions yet. Click "Add Question" to create your first question.</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3b5' }}>
                <p>No questions found for the selected problem set.</p>
              </div>
            ) : (
              <DndProvider backend={HTML5Backend}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>No.</th>
                      <th style={{ width: '150px' }}>Area</th>
                      <th>Question</th>
                      <th style={{ width: '100px' }}>Options</th>
                      <th style={{ width: '100px' }}>Images</th>
                      <th style={{ width: '120px' }}>Problem Sets</th>
                      <th style={{ width: '180px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((question, index) => (
                      <DraggableQuestionItem
                        key={question.id}
                        question={question}
                        index={index}
                        onEdit={() => openQuestionForm(question)}
                        onDelete={() => handleDeleteQuestion(question.id)}
                        onMove={moveQuestion}
                      />
                    ))}
                  </tbody>
                </table>
              </DndProvider>
            )}
          </div>
        </div>
      </div>

      {/* Question Form Modal */}
      {showQuestionForm && (
        <div className="modal-backdrop" style={{ zIndex: 1001 }}>
          <div className="modal-card" style={{ maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>
                {editingQuestion ? "Edit Question" : "Add Question"}
              </h3>
              <button className="ghost-btn" onClick={closeQuestionForm}>
                Close
              </button>
            </div>

            <form className="modal-form" onSubmit={handleQuestionSubmit}>
              {error && <div className="alert error">{error}</div>}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
                <div>
                  <label className="input-label">Question Number *</label>
                  <input
                    type="number"
                    value={questionForm.question_number}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_number: parseInt(e.target.value) || 0 })}
                    className="text-input"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="input-label">Question Area/Category</label>
                  <input
                    type="text"
                    value={questionForm.question_area}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_area: e.target.value })}
                    className="text-input"
                    placeholder="e.g., Regulations, Safety, Operations"
                  />
                </div>
              </div>

              <label className="input-label">Question Text *</label>
              <textarea
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                className="text-input"
                rows={4}
                placeholder="Enter the question text"
                required
              />

              <label className="input-label">Answer Options *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questionForm.options.map((option, index) => (
                  <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="correct_answer"
                      checked={questionForm.correct_answer_index === index}
                      onChange={() => setQuestionForm({ ...questionForm, correct_answer_index: index })}
                      style={{ flexShrink: 0 }}
                    />
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="text-input"
                      placeholder={`Option ${index + 1}`}
                      style={{ flex: 1 }}
                      required
                    />
                    {questionForm.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="ghost-btn"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="ghost-btn"
                style={{ marginTop: 8, fontSize: 12 }}
              >
                + Add Option
              </button>

              <label className="input-label">Explanation (Optional)</label>
              <textarea
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                className="text-input"
                rows={3}
                placeholder="Provide an explanation for the correct answer"
              />

              <label className="input-label">Problem Sets (Optional)</label>
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '14px', color: '#9ca3b5', marginBottom: 12 }}>
                  Add problem set numbers for this question:
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
                        if (value && value > 0 && !questionForm.problem_sets.includes(value)) {
                          setQuestionForm({
                            ...questionForm,
                            problem_sets: [...questionForm.problem_sets, value].sort((a, b) => a - b)
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
                      if (value && value > 0 && !questionForm.problem_sets.includes(value)) {
                        setQuestionForm({
                          ...questionForm,
                          problem_sets: [...questionForm.problem_sets, value].sort((a, b) => a - b)
                        });
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {questionForm.problem_sets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: '12px', color: '#9ca3b5', marginBottom: 8 }}>
                      Selected sets:
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {questionForm.problem_sets.map(setNum => (
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
                              setQuestionForm({
                                ...questionForm,
                                problem_sets: questionForm.problem_sets.filter(n => n !== setNum)
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

              <label className="input-label">Images/Graphs</label>
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
                  onClick={() => document.getElementById('question-image-upload')?.click()}
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
                  id="question-image-upload"
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
                    : editingQuestion
                    ? "Update Question"
                    : "Create Question"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeQuestionForm}
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

      {/* CSV Import Modal */}
      {showCSVImport && (
        <div className="modal-backdrop" style={{ zIndex: 1002 }}>
          <div className="modal-card" style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ margin: 0 }}>Import Questions from CSV</h3>
              <button className="ghost-btn" onClick={() => {
                setShowCSVImport(false);
                setCsvFile(null);
                setCsvPreview([]);
                setError(null);
              }}>
                Close
              </button>
            </div>

            {error && (
              <div className="alert error" style={{ marginTop: 16 }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label className="input-label">CSV Format</label>
              <div style={{ 
                padding: 12, 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 12,
                fontFamily: 'monospace'
              }}>
                <p style={{ margin: 0, marginBottom: 8 }}>Required columns:</p>
                <code>problem_number, problem_area, problem_statement, option_1, option_2, ..., correct_answer</code>
                <p style={{ margin: 0, marginTop: 8, marginBottom: 4 }}>Optional columns:</p>
                <code>explanation, problem_sets</code>
                <p style={{ margin: 0, marginTop: 8 }}>
                  Notes:
                </p>
                <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                  <li>correct_answer should be the option number (1-based index)</li>
                  <li>problem_sets should be comma-separated numbers (e.g., "1,2,4")</li>
                </ul>
              </div>

              {!csvFile ? (
                <div
                  style={{
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('csv-upload-input')?.click()}
                >
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
                  <p style={{ color: '#9ca3b5', margin: 0 }}>
                    Click to upload CSV file
                  </p>
                  <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                    CSV format only
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ 
                    padding: 12, 
                    backgroundColor: 'rgba(107, 140, 174, 0.1)', 
                    borderRadius: 8,
                    marginBottom: 16,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 500 }}>{csvFile.name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#9ca3b5', marginTop: 4 }}>
                        {csvPreview.length} question(s) found
                      </p>
                    </div>
                    <button
                      className="ghost-btn"
                      style={{ fontSize: 12 }}
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview([]);
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="input-label">Import Mode</label>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="radio"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                      />
                      <span>Append - Add to existing questions</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                      />
                      <span>Replace - Delete existing questions and import new ones</span>
                    </label>
                  </div>

                  {csvPreview.length > 0 && (
                    <div>
                      <label className="input-label">Preview (first 5 questions)</label>
                      <div style={{ 
                        maxHeight: 300, 
                        overflow: 'auto',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        padding: 12
                      }}>
                        {csvPreview.slice(0, 5).map((q, idx) => (
                          <div 
                            key={idx}
                            style={{ 
                              marginBottom: 16, 
                              paddingBottom: 16,
                              borderBottom: idx < 4 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none'
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 500, marginBottom: 4 }}>
                              Q{q.question_number}: {q.question_text}
                            </p>
                            <p style={{ margin: 0, fontSize: 12, color: '#9ca3b5', marginBottom: 8 }}>
                              Area: {q.question_area || 'N/A'}
                            </p>
                            <div style={{ fontSize: 12 }}>
                              {q.options.map((opt, optIdx) => (
                                <div 
                                  key={optIdx}
                                  style={{ 
                                    padding: '4px 8px',
                                    marginBottom: 4,
                                    backgroundColor: optIdx === q.correct_answer_index 
                                      ? 'rgba(74, 124, 89, 0.3)' 
                                      : 'transparent',
                                    borderRadius: 4
                                  }}
                                >
                                  {optIdx + 1}. {opt}
                                  {optIdx === q.correct_answer_index && ' ✓'}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                        {csvPreview.length > 5 && (
                          <p style={{ margin: 0, fontSize: 12, color: '#9ca3b5', textAlign: 'center' }}>
                            ... and {csvPreview.length - 5} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button 
                      className="primary-btn" 
                      onClick={handleImportCSV}
                      disabled={importing || csvPreview.length === 0}
                    >
                      {importing ? 'Importing...' : `Import ${csvPreview.length} Question(s)`}
                    </button>
                    <button
                      className="ghost-btn"
                      onClick={() => {
                        setShowCSVImport(false);
                        setCsvFile(null);
                        setCsvPreview([]);
                      }}
                      disabled={importing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <input
                id="csv-upload-input"
                type="file"
                accept=".csv"
                onChange={handleCSVFileChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
