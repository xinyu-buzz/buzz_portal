import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseFullscreenReturn {
  isFullScreen: boolean;
  enterFullScreen: () => Promise<void>;
  exitFullScreen: () => Promise<void>;
  fullScreenRef: React.RefObject<HTMLDivElement>;
}

export const useFullscreen = (): UseFullscreenReturn => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullScreenRef = useRef<HTMLDivElement>(null);

  // Full-screen handlers - Web implementation
  const enterFullScreen = useCallback(async () => {
    if (fullScreenRef.current) {
      try {
        await fullScreenRef.current.requestFullscreen();
        setIsFullScreen(true);
      } catch (error) {
        console.error('Error entering fullscreen:', error);
      }
    }
  }, []);

  const exitFullScreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        setIsFullScreen(false);
      } catch (error) {
        console.error('Error exiting fullscreen:', error);
      }
    }
  }, []);

  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  return {
    isFullScreen,
    enterFullScreen,
    exitFullScreen,
    fullScreenRef,
  };
};