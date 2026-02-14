import { useState, useEffect, useCallback, useRef } from 'react';

export interface CourseUnit {
  id: string;
  title: string;
  content?: string;
  unit_number: number;
}

export interface CourseMaterial {
  index: number;
  name: string;
  url: string;
  type: string;
  isVideo: boolean;
  isImage: boolean;
  isPDF: boolean;
  isQuestion?: boolean;
}

export interface SlideContent {
  type: 'image' | 'video' | 'pdf' | 'question';
  url?: string;
  name?: string;
  question?: {
    question: string;
    options: string[];
    correctAnswer: number;
    explanation?: string;
  };
}

export interface ReviewQuestion {
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string | null;
}

/**
 * Decodes a question from a data URL stored in material_urls
 * @param url - The data URL containing encoded question JSON
 * @returns The decoded ReviewQuestion object or null if invalid
 */
export const decodeBase64 = (base64String: string): string => {
  try {
    return decodeURIComponent(escape(atob(base64String)));
  } catch (error) {
    console.error('Base64 decode error:', error);
    return '';
  }
};

export const getQuestionFromUrl = (url: string): ReviewQuestion | null => {
  try {
    // Check if it's a data URL with JSON content
    if (url.startsWith('data:application/json;base64,')) {
      // Extract the Base64 part
      const base64 = url.replace('data:application/json;base64,', '');

      // Decode Base64 to get JSON string
      const json = decodeBase64(base64);

      // Parse JSON to get the question object
      const question: ReviewQuestion = JSON.parse(json);

      return question;
    }
    return null;
  } catch (error) {
    console.error('Error decoding question from URL:', error);
    return null;
  }
};

export interface UseSlideshowLogicProps {
  unit: CourseUnit;
  materials: CourseMaterial[];
  onComplete: () => void;
}

export interface UseSlideshowLogicReturn {
  // State
  currentSlideIndex: number;
  slideContents: SlideContent[];
  completedSlides: Set<number>;
  selectedAnswer: number | null;
  showAnswerFeedback: boolean;
  isAnswerCorrect: boolean | null;

  // Computed values
  currentSlide: SlideContent | undefined;
  isLastSlide: boolean;
  isCurrentSlideCompleted: boolean;
  progressPercentage: number;

  // Actions
  handleNextSlide: () => void;
  handlePreviousSlide: () => void;
  handleAnswerSubmit: () => void;
  setSelectedAnswer: (answer: number | null) => void;
  markSlideCompleted: (slideIndex: number) => void;
  resetQuestionState: () => void;
}

export const useSlideshowLogic = ({
  unit,
  materials,
  onComplete
}: UseSlideshowLogicProps): UseSlideshowLogicReturn => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideContents, setSlideContents] = useState<SlideContent[]>([]);
  const [completedSlides, setCompletedSlides] = useState<Set<number>>(new Set());
  const hasCompleted = useRef(false);
  const [selectedAnswer, setSelectedAnswerState] = useState<number | null>(null);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);

  // Convert materials to slide contents
  useEffect(() => {
    const contents: SlideContent[] = [];

    // Add materials as slides
    materials.forEach(material => {
      if (material.isVideo) {
        contents.push({
          type: 'video',
          url: material.url,
          name: material.name
        });
      } else if (material.isImage) {
        contents.push({
          type: 'image',
          url: material.url,
          name: material.name
        });
      } else if (material.isPDF) {
        contents.push({
          type: 'pdf',
          url: material.url,
          name: material.name
        });
      } else if (material.type === 'question') {
        // Handle question materials - decode from data URL format
        let questionData;
        try {
          const decodedQuestion = getQuestionFromUrl(material.url);
          if (decodedQuestion) {
            // Map ReviewQuestion to SlideContent question format
            questionData = {
              question: decodedQuestion.question_text,
              options: decodedQuestion.options,
              correctAnswer: decodedQuestion.correct_answer_index,
              explanation: decodedQuestion.explanation || 'Please answer the question to continue.'
            };
            console.log('Successfully decoded question:', decodedQuestion);
          } else {
            // If decoding fails, create placeholder
            console.warn('Could not decode question from material URL:', material.url);
            questionData = {
              question: material.name || 'Question',
              options: ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswer: 0,
              explanation: 'Please answer the question to continue.'
            };
          }
        } catch (error) {
          // Fallback to placeholder if parsing fails
          console.error('Error decoding question data:', error);
          questionData = {
            question: material.name || 'Question',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 0,
            explanation: 'Please answer the question to continue.'
          };
        }

        contents.push({
          type: 'question',
          name: material.name,
          question: questionData
        });
      }
    });

    // Add unit content as text/image slides if it exists and is not empty
    if (unit.content && unit.content.trim().length > 0) {
      // For now, we'll treat unit content as a single slide
      // In the future, this could be parsed for multiple sections
      contents.unshift({
        type: 'image', // Placeholder - could be enhanced to parse content
        name: 'Unit Content'
      });
    }

    setSlideContents(contents);
  }, [unit, materials]);

  const currentSlide = slideContents[currentSlideIndex];
  const isLastSlide = currentSlideIndex === slideContents.length - 1;
  const isCurrentSlideCompleted = completedSlides.has(currentSlideIndex);

  const progressPercentage = slideContents.length > 0
    ? ((currentSlideIndex + 1) / slideContents.length) * 100
    : 0;

  const markSlideCompleted = useCallback((slideIndex: number) => {
    setCompletedSlides(prev => new Set([...prev, slideIndex]));
  }, []);

  const handleAnswerSubmit = useCallback(() => {
    if (selectedAnswer !== null && currentSlide?.type === 'question' && currentSlide.question) {
      const correct = selectedAnswer === currentSlide.question.correctAnswer;
      setIsAnswerCorrect(correct);
      setShowAnswerFeedback(true);

      // Mark slide as completed for correct answers
      if (correct) {
        markSlideCompleted(currentSlideIndex);
      }
    }
  }, [selectedAnswer, currentSlide, currentSlideIndex, markSlideCompleted]);

  const handleNextSlide = useCallback(() => {
    if (isCurrentSlideCompleted && currentSlideIndex < slideContents.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      // Reset question state when moving to next slide
      setSelectedAnswerState(null);
      setShowAnswerFeedback(false);
      setIsAnswerCorrect(null);
    }
  }, [isCurrentSlideCompleted, currentSlideIndex, slideContents.length]);

  const handlePreviousSlide = useCallback(() => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      // Reset question state when moving to previous slide
      setSelectedAnswerState(null);
      setShowAnswerFeedback(false);
      setIsAnswerCorrect(null);
    }
  }, [currentSlideIndex]);

  // Check if all slides are completed
  useEffect(() => {
    if (completedSlides.size === slideContents.length && slideContents.length > 0 && !hasCompleted.current) {
      hasCompleted.current = true;
      onComplete();
    }
  }, [completedSlides, slideContents.length, onComplete]);

  const setSelectedAnswer = useCallback((answer: number | null) => {
    setSelectedAnswerState(answer);
  }, []);

  return {
    // State
    currentSlideIndex,
    slideContents,
    completedSlides,
    selectedAnswer,
    showAnswerFeedback,
    isAnswerCorrect,

    // Computed values
    currentSlide,
    isLastSlide,
    isCurrentSlideCompleted,
    progressPercentage,

  // Actions
  handleNextSlide,
  handlePreviousSlide,
  handleAnswerSubmit,
  setSelectedAnswer,
  markSlideCompleted,
  resetQuestionState: () => {
    setSelectedAnswerState(null);
    setShowAnswerFeedback(false);
    setIsAnswerCorrect(null);
  },
  };
};