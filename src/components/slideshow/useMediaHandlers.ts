import { useCallback } from 'react';

export interface UseMediaHandlersProps {
  markSlideCompleted: (slideIndex: number) => void;
  currentSlideIndex: number;
}

export interface UseMediaHandlersReturn {
  handleVideoEnd: (slideIndex?: number) => void;
  handleImageLoad: () => void;
  handlePdfLoad: () => void;
}

export const useMediaHandlers = ({
  markSlideCompleted,
  currentSlideIndex
}: UseMediaHandlersProps): UseMediaHandlersReturn => {

  const handleVideoEnd = useCallback((slideIndex?: number) => {
    const targetIndex = slideIndex ?? currentSlideIndex;
    markSlideCompleted(targetIndex);
  }, [markSlideCompleted, currentSlideIndex]);

  const handleImageLoad = useCallback(() => {
    markSlideCompleted(currentSlideIndex);
  }, [markSlideCompleted, currentSlideIndex]);

  const handlePdfLoad = useCallback(() => {
    markSlideCompleted(currentSlideIndex);
  }, [markSlideCompleted, currentSlideIndex]);

  return {
    handleVideoEnd,
    handleImageLoad,
    handlePdfLoad,
  };
};