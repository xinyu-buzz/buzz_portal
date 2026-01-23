import { useEffect, useState } from "react";
import { supabaseClient } from "../../utility";
import { useNavigate } from "react-router-dom";

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
  cover_image_url: string | null;
  region: "Canada" | "USA" | "UK" | "Australia" | "New Zealand" | "South Africa" | "Global";
  active: boolean;
};

const PROVIDERS = ["Buzz", "Red Cross", "USFA", "FEMA", "Amazon", "T-Mobile", "Other"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const CATEGORIES = ["Mandatory", "Extension", "Intermediate", "Advanced", "Specialized", "General"];
const REGIONS = ["Canada", "USA", "UK", "Australia", "New Zealand", "South Africa", "Global"];

export const AcademyCourses = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TrainingCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingCourse, setEditingCourse] = useState<TrainingCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
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
    region: "Global",
    active: false,
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

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
        return;
      }
      
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      setCoverImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const removeCoverImage = () => {
    setCoverImageFile(null);
    setCoverImagePreview(null);
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
      region: "Global",
      active: false,
    });
    setCoverImageFile(null);
    setCoverImagePreview(null);
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

    let coverImageUrl: string | null = null;

    // Upload cover image if provided
    if (coverImageFile) {
      // #region agent log
      const session = await supabaseClient.auth.getSession();
      fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:CREATE_UPLOAD_START',message:'Starting cover upload',data:{hasSession:!!session.data.session,userId:session.data.session?.user?.id,fileName:coverImageFile.name,fileSize:coverImageFile.size,fileType:coverImageFile.type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,E'})}).catch(()=>{});
      // #endregion

      setUploadingCover(true);
      try {
        const fileExt = coverImageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:CREATE_BEFORE_UPLOAD',message:'Before storage upload',data:{filePath,fileExt,bucketName:'course-covers'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion

        const { error: uploadError } = await supabaseClient.storage
          .from('course-covers')
          .upload(filePath, coverImageFile, {
            cacheControl: '3600',
            upsert: false
          });

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:CREATE_AFTER_UPLOAD',message:'After storage upload attempt',data:{hasError:!!uploadError,errorMessage:uploadError?.message,errorDetails:JSON.stringify(uploadError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D'})}).catch(()=>{});
        // #endregion

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: publicUrlData } = supabaseClient.storage
          .from('course-covers')
          .getPublicUrl(filePath);

        coverImageUrl = publicUrlData.publicUrl;

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:CREATE_SUCCESS',message:'Upload successful',data:{coverImageUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
        // #endregion
      } catch (uploadError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:CREATE_CATCH_ERROR',message:'Upload failed in catch',data:{errorMessage:uploadError?.message,errorName:uploadError?.name,errorCode:uploadError?.code,fullError:JSON.stringify(uploadError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D'})}).catch(()=>{});
        // #endregion
        console.error('Upload error:', uploadError);
        setError(`Failed to upload cover image: ${uploadError.message}`);
        setSubmitting(false);
        setUploadingCover(false);
        return;
      }
      setUploadingCover(false);
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

    if (coverImageUrl) {
      payload.cover_image_url = coverImageUrl;
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

    let coverImageUrl: string | null = editingCourse.cover_image_url;

    // Upload new cover image if provided
    if (coverImageFile) {
      // #region agent log
      const session = await supabaseClient.auth.getSession();
      fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_UPLOAD_START',message:'Starting update cover upload',data:{hasSession:!!session.data.session,userId:session.data.session?.user?.id,fileName:coverImageFile.name,fileSize:coverImageFile.size,fileType:coverImageFile.type,oldCoverUrl:editingCourse.cover_image_url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C,E'})}).catch(()=>{});
      // #endregion

      setUploadingCover(true);
      try {
        // Delete old cover image if exists
        if (editingCourse.cover_image_url) {
          const oldFilePath = editingCourse.cover_image_url.split('/').pop();
          if (oldFilePath) {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_DELETE_OLD',message:'Attempting to delete old image',data:{oldFilePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion

            await supabaseClient.storage
              .from('course-covers')
              .remove([oldFilePath]);
          }
        }

        const fileExt = coverImageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_BEFORE_UPLOAD',message:'Before storage upload',data:{filePath,fileExt},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion

        const { error: uploadError } = await supabaseClient.storage
          .from('course-covers')
          .upload(filePath, coverImageFile, {
            cacheControl: '3600',
            upsert: false
          });

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_AFTER_UPLOAD',message:'After storage upload attempt',data:{hasError:!!uploadError,errorMessage:uploadError?.message,errorDetails:JSON.stringify(uploadError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D'})}).catch(()=>{});
        // #endregion

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: publicUrlData } = supabaseClient.storage
          .from('course-covers')
          .getPublicUrl(filePath);

        coverImageUrl = publicUrlData.publicUrl;

        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_SUCCESS',message:'Upload successful',data:{coverImageUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
        // #endregion
      } catch (uploadError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/3f50e357-e4fc-486f-8d1d-6d21395dc435',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AcademyCourses.tsx:UPDATE_CATCH_ERROR',message:'Upload failed in catch',data:{errorMessage:uploadError?.message,errorName:uploadError?.name,errorCode:uploadError?.code,fullError:JSON.stringify(uploadError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D'})}).catch(()=>{});
        // #endregion
        console.error('Upload error:', uploadError);
        setError(`Failed to upload cover image: ${uploadError.message}`);
        setSubmitting(false);
        setUploadingCover(false);
        return;
      }
      setUploadingCover(false);
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
      region: form.region,
      active: form.active,
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

    if (coverImageUrl) {
      payload.cover_image_url = coverImageUrl;
    } else {
      payload.cover_image_url = null;
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

  const handleDuplicate = async () => {
    if (!editingCourse) return;
    if (!confirm(`Are you sure you want to duplicate "${editingCourse.title}"? This will create a copy of the course with all its sections, units, tests, and questions.`)) return;

    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Create the new course with "(Copy)" suffix
      const newCoursePayload: Record<string, any> = {
        title: `${editingCourse.title} (Copy)`,
        description: editingCourse.description,
        duration: editingCourse.duration,
        level: editingCourse.level,
        category: editingCourse.category,
        instructor: editingCourse.instructor,
        provider: editingCourse.provider,
        instructor_picture_url: editingCourse.instructor_picture_url,
        requires_uas_ground_school: editingCourse.requires_uas_ground_school,
        requires_flight_review_passed: editingCourse.requires_flight_review_passed,
        requires_roc_a_passed: editingCourse.requires_roc_a_passed,
        external_url: editingCourse.external_url,
        cover_image_url: editingCourse.cover_image_url,
        region: editingCourse.region,
        active: false, // Start as inactive so admin can review before publishing
      };

      const { data: newCourse, error: courseError } = await supabaseClient
        .from("training_courses")
        .insert(newCoursePayload)
        .select()
        .single();

      if (courseError) throw courseError;

      const newCourseId = newCourse.id;

      // Step 2: Fetch and duplicate sections
      const { data: originalSections, error: sectionsError } = await supabaseClient
        .from("course_sections")
        .select("*")
        .eq("course_id", editingCourse.id)
        .order("display_order", { ascending: true });

      if (sectionsError) throw sectionsError;

      const sectionIdMap: Record<string, string> = {}; // old ID -> new ID

      if (originalSections && originalSections.length > 0) {
        // First pass: insert sections without prerequisite_section_id
        for (const section of originalSections) {
          const newSectionPayload = {
            course_id: newCourseId,
            name: section.name,
            display_order: section.display_order,
            description: section.description,
            section_type: section.section_type,
            requires_subscription: section.requires_subscription,
            requires_test_passed: section.requires_test_passed,
            prerequisite_section_id: null, // Will update in second pass
            is_active: section.is_active,
            exam_type: section.exam_type,
          };

          const { data: newSection, error: insertSectionError } = await supabaseClient
            .from("course_sections")
            .insert(newSectionPayload)
            .select()
            .single();

          if (insertSectionError) throw insertSectionError;

          sectionIdMap[section.id] = newSection.id;
        }

        // Second pass: update prerequisite_section_id references
        for (const section of originalSections) {
          if (section.prerequisite_section_id && sectionIdMap[section.prerequisite_section_id]) {
            const newSectionId = sectionIdMap[section.id];
            const newPrerequisiteSectionId = sectionIdMap[section.prerequisite_section_id];

            await supabaseClient
              .from("course_sections")
              .update({ prerequisite_section_id: newPrerequisiteSectionId })
              .eq("id", newSectionId);
          }
        }
      }

      // Step 3: Fetch original tests to build test ID map first (needed for unit prerequisite_tests)
      const { data: originalTests, error: testsError } = await supabaseClient
        .from("course_tests")
        .select("*")
        .eq("course_id", editingCourse.id)
        .order("order_index", { ascending: true });

      if (testsError) throw testsError;

      const testIdMap: Record<string, string> = {}; // old ID -> new ID

      // Step 4: Duplicate tests
      if (originalTests && originalTests.length > 0) {
        for (const test of originalTests) {
          const newTestPayload = {
            course_id: newCourseId,
            test_name: test.test_name,
            test_description: test.test_description,
            test_type: test.test_type,
            passing_score: test.passing_score,
            required_for_progression: test.required_for_progression,
            required_units: test.required_units,
            order_index: test.order_index,
            questions: test.questions,
            is_active: test.is_active,
            section_id: test.section_id ? sectionIdMap[test.section_id] || null : null,
            needs_proctor: test.needs_proctor,
            duration: test.duration || 60,
            price_of_schedule: test.price_of_schedule ?? null,
            question_source: test.question_source || 'csv',
          };

          const { data: newTest, error: insertTestError } = await supabaseClient
            .from("course_tests")
            .insert(newTestPayload)
            .select()
            .single();

          if (insertTestError) throw insertTestError;

          testIdMap[test.id] = newTest.id;
        }
      }

      // Step 5: Duplicate units with updated section_id and prerequisite_tests
      const { data: originalUnits, error: unitsError } = await supabaseClient
        .from("course_units")
        .select("*")
        .eq("course_id", editingCourse.id)
        .order("order_index", { ascending: true });

      if (unitsError) throw unitsError;

      if (originalUnits && originalUnits.length > 0) {
        for (const unit of originalUnits) {
          // Map prerequisite_tests to new test IDs
          const newPrerequisiteTests = unit.prerequisite_tests
            ? unit.prerequisite_tests.map((oldTestId: string) => testIdMap[oldTestId] || oldTestId)
            : [];

          const newUnitPayload = {
            course_id: newCourseId,
            unit_number: unit.unit_number,
            title: unit.title,
            description: unit.description,
            content: unit.content,
            step_number: unit.step_number,
            is_mandatory: unit.is_mandatory,
            order_index: unit.order_index,
            pdf_url: unit.pdf_url,
            pdf_names: unit.pdf_names,
            section_id: unit.section_id ? sectionIdMap[unit.section_id] || null : null,
            prerequisite_units: unit.prerequisite_units,
            prerequisite_tests: newPrerequisiteTests,
            material_urls: unit.material_urls || [],
            material_names: unit.material_names || [],
            material_types: unit.material_types || [],
            material_part_names: unit.material_part_names || [],
            material_parts: unit.material_parts || [],
          };

          const { error: insertUnitError } = await supabaseClient
            .from("course_units")
            .insert(newUnitPayload);

          if (insertUnitError) throw insertUnitError;
        }
      }

      // Step 6: Duplicate test questions for each test
      for (const oldTestId of Object.keys(testIdMap)) {
        const newTestId = testIdMap[oldTestId];

        const { data: originalQuestions, error: questionsError } = await supabaseClient
          .from("test_questions")
          .select("*")
          .eq("test_id", oldTestId)
          .order("question_number", { ascending: true });

        if (questionsError) {
          console.error("Error fetching questions for test:", oldTestId, questionsError);
          continue; // Skip if test_questions table doesn't exist or other error
        }

        if (originalQuestions && originalQuestions.length > 0) {
          const newQuestionsPayload = originalQuestions.map((q) => ({
            test_id: newTestId,
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
            .insert(newQuestionsPayload);

          if (insertQuestionsError) {
            console.error("Error inserting questions for test:", newTestId, insertQuestionsError);
          }
        }
      }

      // Success - close modal and reload
      setShowEdit(false);
      setEditingCourse(null);
      resetForm();
      await load();
      alert(`Course "${editingCourse.title}" has been duplicated successfully!`);
    } catch (err: any) {
      console.error("Error duplicating course:", err);
      setError(`Failed to duplicate course: ${err.message}`);
    }

    setSubmitting(false);
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
      region: course.region || "Global",
      active: course.active || false,
    });
    // Set preview if there's an existing cover image
    if (course.cover_image_url) {
      setCoverImagePreview(course.cover_image_url);
    }
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
    setSelectedRegion(null);
    setSelectedCategory(null);
    setSearchQuery("");
  };

  const activeFilterCount = [
    selectedProvider,
    selectedRegion,
    selectedCategory,
    searchQuery ? "search" : null,
  ].filter(Boolean).length;

  const filteredRows = rows.filter((row) => {
    if (selectedProvider && row.provider !== selectedProvider) return false;
    if (selectedRegion && row.region !== selectedRegion) return false;
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
          width: "100%",
          boxSizing: "border-box",
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

            {/* Region Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "12px",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Region
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() =>
                      setSelectedRegion(
                        selectedRegion === region ? null : region
                      )
                    }
                    style={{
                      padding: "8px 16px",
                      borderRadius: "20px",
                      border: "none",
                      backgroundColor:
                        selectedRegion === region
                          ? "#6b8cae"
                          : "rgba(255, 255, 255, 0.1)",
                      color: selectedRegion === region ? "white" : "#9ca3b5",
                      cursor: "pointer",
                      fontSize: "14px",
                      transition: "all 0.2s",
                    }}
                  >
                    {region}
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
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Provider</th>
                  <th>Region</th>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Instructor</th>
                  <th>Students</th>
                  <th>Active</th>
                  <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.title}</td>
                  <td>{row.provider}</td>
                  <td>{row.region}</td>
                  <td>{row.category}</td>
                  <td>{row.level}</td>
                  <td>{row.instructor}</td>
                  <td>{row.students_count}</td>
                  <td>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: row.active 
                          ? "rgba(34, 197, 94, 0.2)" 
                          : "rgba(156, 163, 175, 0.2)",
                        color: row.active ? "#22c55e" : "#9ca3b5",
                      }}
                    >
                      {row.active ? "Yes" : "No"}
                    </span>
                  </td>
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
                      {row.provider === "Buzz" && (
                        <button
                          className="primary-btn"
                          style={{ 
                            padding: "6px 10px", 
                            fontSize: 12,
                            backgroundColor: "#6b8cae"
                          }}
                          onClick={() => navigate(`/admin/academy-courses/${row.id}/units`)}
                        >
                          More
                        </button>
                      )}
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
          </div>
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

              <label className="input-label">Course Cover Image</label>
              <div style={{ marginBottom: 16 }}>
                {coverImagePreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img
                      src={coverImagePreview}
                      alt="Course cover preview"
                      style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: 'auto',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        marginBottom: '8px'
                      }}
                    />
                    <button
                      type="button"
                      onClick={removeCoverImage}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
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
                    onClick={() => document.getElementById('cover-image-input')?.click()}
                  >
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📷</div>
                    <p style={{ color: '#9ca3b5', margin: 0 }}>
                      Click to upload course cover
                    </p>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
                      JPEG, PNG, WebP, or GIF (max 5MB)
                    </p>
                  </div>
                )}
                <input
                  id="cover-image-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleCoverImageChange}
                  style={{ display: 'none' }}
                />
              </div>

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

              <label className="input-label">Region *</label>
              <select
                name="region"
                value={form.region}
                onChange={onChange}
                className="text-input"
                required
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 16, marginBottom: 8 }}>
                <label className="input-label" style={{ fontWeight: 600 }}>
                  Course Status
                </label>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input
                  type="checkbox"
                  name="active"
                  checked={form.active}
                  onChange={onChange}
                />
                <span>Active (Course is visible to users)</span>
              </label>

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
                <button type="submit" className="primary-btn" disabled={submitting || uploadingCover}>
                  {uploadingCover
                    ? "Uploading image..."
                    : submitting
                    ? showCreate
                      ? "Creating..."
                      : "Updating..."
                    : showCreate
                      ? "Create course"
                      : "Update course"}
                </button>
                {showEdit && (
                  <button
                    type="button"
                    className="primary-btn"
                    style={{ backgroundColor: '#6b8cae' }}
                    onClick={handleDuplicate}
                    disabled={submitting || uploadingCover}
                  >
                    Duplicate course
                  </button>
                )}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={closeModals}
                  disabled={submitting || uploadingCover}
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
