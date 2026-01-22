import { useState } from 'react';
import PdfViewer from './PdfViewer';
import { useSlideshowLogic, CourseUnit, CourseMaterial } from './useSlideshowLogic';
import { useFullscreen } from './useFullscreen';
import { useMediaHandlers } from './useMediaHandlers';

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
  };

  if (slideshowLogic.slideContents.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '384px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '64px', color: '#9ca3af', marginBottom: '16px' }}>
            🎓
          </div>
          <p style={{ color: '#6b7280', fontSize: '16px' }}>
            No presentation content available
          </p>
        </div>
      </div>
    );
  }

  // Get the first slide for preview
  const firstSlide = slideshowLogic.slideContents[0];

  return (
    <div style={{ width: '100%' }} ref={fullScreenRef}>
      {/* Preview Mode */}
      {isPreviewMode && (
        <div style={{ marginBottom: '16px' }}>
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              position: 'relative',
              cursor: 'pointer',
              minHeight: isFullScreen ? 'calc(100vh - 120px)' : '600px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={handleStartPresentation}
          >
            {/* Blurred Background */}
            {firstSlide && (
              <div style={{
                position: 'absolute',
                inset: 0,
                filter: 'blur(8px)',
                transform: 'scale(1.1)',
                zIndex: 0
              }}>
                {firstSlide.type === 'image' && firstSlide.url ? (
                  <img
                    src={firstSlide.url}
                    alt={firstSlide.name || 'Slide preview'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : firstSlide.type === 'video' && firstSlide.url ? (
                  <video
                    src={firstSlide.url}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    muted
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '120px', opacity: 0.3 }}>🎓</span>
                  </div>
                )}
              </div>
            )}

            {/* Dark Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              zIndex: 1
            }}></div>

            {/* Play Button Overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: '#3b82f6',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  transition: 'background-color 0.2s'
                }}>
                  <span style={{ fontSize: '32px', color: 'white' }}>▶️</span>
                </div>
                <p style={{
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '500',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>
                  Click to start presentation
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator - Only show when not in preview mode */}
      {!isPreviewMode && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Slide {slideshowLogic.currentSlideIndex + 1} of {slideshowLogic.slideContents.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {slideshowLogic.completedSlides.size}/{slideshowLogic.slideContents.length} completed
              </span>
              {!isFullScreen && (
                <button
                  onClick={enterFullScreen}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  title="Enter fullscreen"
                >
                  ⛶ Fullscreen
                </button>
              )}
            </div>
          </div>
          <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '8px' }}>
            <div
              style={{
                backgroundColor: '#3b82f6',
                height: '8px',
                borderRadius: '9999px',
                transition: 'width 0.3s',
                width: `${slideshowLogic.progressPercentage}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Slide Content - Only show when not in preview mode */}
      {!isPreviewMode && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          marginBottom: '16px',
          minHeight: isFullScreen ? 'calc(100vh - 120px)' : '600px'
        }}>
          {slideshowLogic.currentSlide?.type === 'pdf' && slideshowLogic.currentSlide.url && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: isFullScreen ? '100%' : '600px'
            }}>
              <PdfViewer
                url={slideshowLogic.currentSlide.url!}
                title={slideshowLogic.currentSlide.name}
                onLoad={handlePdfLoad}
              />
            </div>
          )}

          {slideshowLogic.currentSlide?.type === 'image' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: isFullScreen ? '100%' : '600px'
            }}>
              {slideshowLogic.currentSlide.url ? (
                <img
                  src={slideshowLogic.currentSlide.url}
                  alt={slideshowLogic.currentSlide.name || 'Slide content'}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  onLoad={handleImageLoad}
                />
              ) : unit.content ? (
                <div style={{ textAlign: 'center', maxWidth: '672px', padding: '0 16px' }}>
                  <p style={{ color: '#374151', fontSize: '18px', lineHeight: '1.75' }}>
                    {unit.content}
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>🖼️</div>
                  <p style={{ color: '#6b7280', marginTop: '16px' }}>
                    Image content
                  </p>
                  <button
                    onClick={handleImageLoad}
                    style={{
                      marginTop: '16px',
                      padding: '8px 24px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    Continue
                  </button>
                </div>
              )}
            </div>
          )}

          {slideshowLogic.currentSlide?.type === 'video' && (
            <div style={{ padding: '16px' }}>
              <div style={{
                aspectRatio: '16 / 9',
                backgroundColor: 'black',
                borderRadius: '8px',
                overflow: 'hidden',
                marginBottom: '16px'
              }}>
                <video
                  src={slideshowLogic.currentSlide.url}
                  controls
                  style={{ width: '100%', height: '100%' }}
                  onEnded={() => handleVideoEnd()}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#374151', marginBottom: '16px' }}>
                  {slideshowLogic.currentSlide.name || 'Video Content'}
                </p>
                {slideshowLogic.isCurrentSlideCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#059669' }}>
                    <span>✓</span>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Video completed</span>
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#6b7280' }}>
                    Please watch the video to continue
                  </p>
                )}
              </div>
            </div>
          )}

          {slideshowLogic.currentSlide?.type === 'question' && slideshowLogic.currentSlide.question && (
            <div style={{ padding: '16px' }}>
              <div style={{ maxWidth: '768px', margin: '0 auto' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '24px' }}>
                  {slideshowLogic.currentSlide.question.question}
                </h3>

                {!slideshowLogic.showAnswerFeedback ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {slideshowLogic.currentSlide.question.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => !slideshowLogic.showAnswerFeedback && slideshowLogic.setSelectedAnswer(index)}
                        disabled={slideshowLogic.showAnswerFeedback}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '16px',
                          borderRadius: '8px',
                          border: slideshowLogic.selectedAnswer === index ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                          backgroundColor: slideshowLogic.selectedAnswer === index ? 'rgba(59, 130, 246, 0.1)' : 'white',
                          color: slideshowLogic.selectedAnswer === index ? '#3b82f6' : '#374151',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span style={{ fontWeight: '500' }}>
                          {String.fromCharCode(65 + index)}. {option}
                        </span>
                      </button>
                    ))}

                    <button
                      onClick={slideshowLogic.handleAnswerSubmit}
                      disabled={slideshowLogic.selectedAnswer === null || slideshowLogic.showAnswerFeedback}
                      style={{
                        width: '100%',
                        marginTop: '24px',
                        padding: '12px 24px',
                        backgroundColor: slideshowLogic.selectedAnswer === null ? '#9ca3af' : '#3b82f6',
                        color: 'white',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: slideshowLogic.selectedAnswer === null ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s',
                        opacity: slideshowLogic.selectedAnswer === null ? 0.5 : 1
                      }}
                    >
                      Submit Answer
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      backgroundColor: slideshowLogic.isAnswerCorrect ? '#d1fae5' : '#fee2e2',
                      color: slideshowLogic.isAnswerCorrect ? '#065f46' : '#991b1b'
                    }}>
                      <span>{slideshowLogic.isAnswerCorrect ? '✓' : '✗'}</span>
                      <span style={{ fontWeight: '500' }}>
                        {slideshowLogic.isAnswerCorrect ? 'Correct!' : 'Incorrect'}
                      </span>
                    </div>

                    {slideshowLogic.currentSlide.question.explanation && (
                      <p style={{ color: '#374151', fontSize: '14px', lineHeight: '1.75', marginBottom: '16px' }}>
                        {slideshowLogic.currentSlide.question.explanation}
                      </p>
                    )}

                    {!slideshowLogic.isAnswerCorrect && (
                      <button
                        onClick={slideshowLogic.resetQuestionState}
                        style={{
                          padding: '8px 24px',
                          backgroundColor: '#e5e7eb',
                          color: '#111827',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={slideshowLogic.handlePreviousSlide}
            disabled={slideshowLogic.currentSlideIndex === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: slideshowLogic.currentSlideIndex === 0 ? '#9ca3af' : '#e5e7eb',
              color: '#111827',
              borderRadius: '8px',
              border: 'none',
              cursor: slideshowLogic.currentSlideIndex === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: slideshowLogic.currentSlideIndex === 0 ? 0.5 : 1
            }}
          >
            <span>←</span>
            Previous
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isFullScreen && (
              <button
                onClick={exitFullScreen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: '#e5e7eb',
                  color: '#111827',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                title="Exit fullscreen"
              >
                <span>⛶</span>
                Exit Fullscreen
              </button>
            )}

            {slideshowLogic.isLastSlide ? (
              <button
                onClick={onComplete}
                disabled={!slideshowLogic.isCurrentSlideCompleted}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: !slideshowLogic.isCurrentSlideCompleted ? '#9ca3af' : '#059669',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: !slideshowLogic.isCurrentSlideCompleted ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: !slideshowLogic.isCurrentSlideCompleted ? 0.5 : 1
                }}
              >
                Complete Unit
                <span>✓</span>
              </button>
            ) : (
              <button
                onClick={slideshowLogic.handleNextSlide}
                disabled={!slideshowLogic.isCurrentSlideCompleted}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  backgroundColor: !slideshowLogic.isCurrentSlideCompleted ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: !slideshowLogic.isCurrentSlideCompleted ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  opacity: !slideshowLogic.isCurrentSlideCompleted ? 0.5 : 1
                }}
              >
                Next Slide
                <span>→</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full-screen Floating Navigation - Only show when not in preview mode */}
      {!isPreviewMode && isFullScreen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50
        }}>
          {/* Previous Button - Left side */}
          {slideshowLogic.currentSlideIndex > 0 && (
            <button
              onClick={slideshowLogic.handlePreviousSlide}
              style={{
                pointerEvents: 'auto',
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
              }}
              title="Previous slide"
            >
              <span style={{ fontSize: '36px' }}>‹</span>
            </button>
          )}

          {/* Next Button - Right side */}
          {!slideshowLogic.isLastSlide && slideshowLogic.isCurrentSlideCompleted && (
            <button
              onClick={slideshowLogic.handleNextSlide}
              style={{
                pointerEvents: 'auto',
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
              }}
              title="Next slide"
            >
              <span style={{ fontSize: '36px' }}>›</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
