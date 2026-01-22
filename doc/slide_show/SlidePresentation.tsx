import { useState } from 'react';
import { CourseUnit, CourseMaterial } from '../types';
import PdfViewer from './PdfViewer';
import { useSlideshowLogic } from '../hooks/useSlideshowLogic';
import { useFullscreen } from '../hooks/useFullscreen';
import { useMediaHandlers } from '../hooks/useMediaHandlers';

interface SlidePresentationProps {
  unit: CourseUnit;
  materials: CourseMaterial[];
  onComplete: () => void;
}

export default function SlidePresentation({ unit, materials, onComplete }: SlidePresentationProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(true);

  // Use shared logic hooks
  const slideshowLogic = useSlideshowLogic({ unit, materials, onComplete });
  const { isFullScreen, enterFullScreen, exitFullScreen, fullScreenRef } = useFullscreen();
  const { handleVideoEnd, handleImageLoad, handlePdfLoad } = useMediaHandlers({
    markSlideCompleted: slideshowLogic.markSlideCompleted,
    currentSlideIndex: slideshowLogic.currentSlideIndex,
  });

  const handleStartPresentation = () => {
    setIsPreviewMode(false);
    enterFullScreen();
  };

  if (slideshowLogic.slideContents.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '64px' }}>
            school
          </span>
          <p className="text-gray-500 dark:text-gray-400 mt-4">
            No presentation content available
          </p>
        </div>
      </div>
    );
  }

  // Get the first slide for preview
  const firstSlide = slideshowLogic.slideContents[0];

  return (
    <div className={`${isFullScreen ? 'w-full' : 'max-w-7xl mx-auto px-2'}`} ref={fullScreenRef}>
      {/* Preview Mode */}
      {isPreviewMode && (
        <div className="mb-4">
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden relative cursor-pointer ${
            isFullScreen ? 'h-[calc(100vh-120px)]' : 'min-h-[600px]'
          }`} onClick={handleStartPresentation}>
            {/* Blurred Background */}
            {firstSlide && (
              <div className="absolute inset-0 filter blur-sm scale-110">
                {firstSlide.type === 'image' && firstSlide.url ? (
                  <img
                    src={firstSlide.url}
                    alt={firstSlide.name || 'Slide preview'}
                    className="w-full h-full object-cover"
                  />
                ) : firstSlide.type === 'video' && firstSlide.url ? (
                  <video
                    src={firstSlide.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary/30" style={{ fontSize: '120px' }}>
                      school
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-black/40"></div>

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: '32px' }}>
                    play_arrow
                  </span>
                </div>
                <p className="text-white text-lg font-medium drop-shadow-lg">
                  Click to start presentation
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator - Only show when not in preview mode */}
      {!isPreviewMode && (
        <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Slide {slideshowLogic.currentSlideIndex + 1} of {slideshowLogic.slideContents.length}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {slideshowLogic.completedSlides.size}/{slideshowLogic.slideContents.length} completed
            </span>
            {!isFullScreen && (
              <button
                onClick={enterFullScreen}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                title="Enter fullscreen"
              >
                <span className="material-symbols-outlined text-lg">fullscreen</span>
                Fullscreen
              </button>
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${slideshowLogic.progressPercentage}%` }}
          />
        </div>
      </div>
      )}

      {/* Slide Content - Only show when not in preview mode */}
      {!isPreviewMode && (
        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-4 ${
          isFullScreen ? 'h-[calc(100vh-120px)]' : 'min-h-[600px]'
        }`}>
        {slideshowLogic.currentSlide?.type === 'pdf' && slideshowLogic.currentSlide.url && (
          <div className={`flex items-center justify-center ${
            isFullScreen ? 'h-full' : 'h-[600px]'
          }`}>
            <PdfViewer
              url={slideshowLogic.currentSlide.url!}
              title={slideshowLogic.currentSlide.name}
              onLoad={handlePdfLoad}
            />
          </div>
        )}

        {slideshowLogic.currentSlide?.type === 'image' && (
          <div className={`flex items-center justify-center ${
            isFullScreen ? 'h-full' : 'h-[600px]'
          }`}>
            {slideshowLogic.currentSlide.url ? (
              <img
                src={slideshowLogic.currentSlide.url}
                alt={slideshowLogic.currentSlide.name || 'Slide content'}
                className="max-w-full max-h-full object-contain"
                onLoad={handleImageLoad}
              />
            ) : unit.content ? (
              <div className="text-center max-w-2xl px-4">
                <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                  {unit.content}
                </p>
                <button
                  onClick={handleImageLoad}
                  className="mt-6 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="text-center">
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: '64px' }}>
                  image
                </span>
                <p className="text-gray-500 dark:text-gray-400 mt-4">
                  Image content
                </p>
                <button
                  onClick={handleImageLoad}
                  className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {slideshowLogic.currentSlide?.type === 'video' && (
          <div className="p-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                <video
                  src={slideshowLogic.currentSlide.url}
                  controls
                  className="w-full h-full"
                  onEnded={() => handleVideoEnd()}
                />
            </div>
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {slideshowLogic.currentSlide.name || 'Video Content'}
              </p>
              {slideshowLogic.isCurrentSlideCompleted ? (
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span className="text-sm font-medium">Video completed</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Please watch the video to continue
                </p>
              )}
            </div>
          </div>
        )}

        {slideshowLogic.currentSlide?.type === 'question' && slideshowLogic.currentSlide.question && (
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {slideshowLogic.currentSlide.question.question}
              </h3>

              {!slideshowLogic.showAnswerFeedback ? (
                <div className="space-y-3">
                  {slideshowLogic.currentSlide.question.options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => !slideshowLogic.showAnswerFeedback && slideshowLogic.setSelectedAnswer(index)}
                      disabled={slideshowLogic.showAnswerFeedback}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        slideshowLogic.showAnswerFeedback && slideshowLogic.currentSlide?.question
                          ? index === slideshowLogic.currentSlide.question.correctAnswer
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : index === slideshowLogic.selectedAnswer && !slideshowLogic.isAnswerCorrect
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                            : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                          : slideshowLogic.selectedAnswer === index
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 dark:border-gray-600 hover:border-primary/50'
                      }`}
                    >
                      <span className="font-medium">
                        {String.fromCharCode(65 + index)}. {option}
                      </span>
                    </button>
                  ))}

                  <button
                    onClick={slideshowLogic.handleAnswerSubmit}
                    disabled={slideshowLogic.selectedAnswer === null || slideshowLogic.showAnswerFeedback}
                    className="w-full mt-6 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Answer
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-4 ${
                    slideshowLogic.isAnswerCorrect
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                  }`}>
                    <span className="material-symbols-outlined">
                      {slideshowLogic.isAnswerCorrect ? 'check_circle' : 'cancel'}
                    </span>
                    <span className="font-medium">
                      {slideshowLogic.isAnswerCorrect ? 'Correct!' : 'Incorrect'}
                    </span>
                  </div>

                  {slideshowLogic.currentSlide.question.explanation && (
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
                      {slideshowLogic.currentSlide.question.explanation}
                    </p>
                  )}

                  {!slideshowLogic.isAnswerCorrect && (
                    <button
                      onClick={slideshowLogic.resetQuestionState}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Navigation Controls - Only show when not in preview mode */}
      {!isPreviewMode && (
        <div className="flex justify-between items-center">
        <button
          onClick={slideshowLogic.handlePreviousSlide}
          disabled={slideshowLogic.currentSlideIndex === 0}
          className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Previous
        </button>

        <div className="flex items-center gap-3">
          {isFullScreen && (
            <button
              onClick={exitFullScreen}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              title="Exit fullscreen"
            >
              <span className="material-symbols-outlined">fullscreen_exit</span>
              Exit Fullscreen
            </button>
          )}

          {slideshowLogic.isLastSlide ? (
            <button
              onClick={onComplete}
              disabled={!slideshowLogic.isCurrentSlideCompleted}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete Unit
              <span className="material-symbols-outlined">check_circle</span>
            </button>
          ) : (
            <button
              onClick={slideshowLogic.handleNextSlide}
              disabled={!slideshowLogic.isCurrentSlideCompleted}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Slide
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Full-screen Floating Navigation - Only show when not in preview mode */}
      {!isPreviewMode && isFullScreen && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {/* Previous Button - Left side */}
          {slideshowLogic.currentSlideIndex > 0 && (
            <button
              onClick={slideshowLogic.handlePreviousSlide}
              className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/70 hover:bg-black/90 text-white rounded-full transition-all shadow-lg"
              title="Previous slide"
            >
              <span className="material-symbols-outlined text-4xl">chevron_left</span>
            </button>
          )}

          {/* Next Button - Right side */}
          {!slideshowLogic.isLastSlide && slideshowLogic.isCurrentSlideCompleted && (
            <button
              onClick={slideshowLogic.handleNextSlide}
              className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/70 hover:bg-black/90 text-white rounded-full transition-all shadow-lg"
              title="Next slide"
            >
              <span className="material-symbols-outlined text-4xl">chevron_right</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}