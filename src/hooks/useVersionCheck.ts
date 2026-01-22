import { useEffect, useState } from 'react';

interface VersionInfo {
  version: number;
  commit?: string;
}

export const useVersionCheck = (checkInterval = 60000) => { // Check every minute by default
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json', {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) return;

        const newVersion: VersionInfo = await response.json();

        if (currentVersion && currentVersion.version !== newVersion.version) {
          setShowRefreshPrompt(true);
        } else if (!currentVersion) {
          setCurrentVersion(newVersion);
        }
      } catch (error) {
        console.warn('Failed to check version:', error);
      }
    };

    // Initial check
    checkVersion();

    // Set up periodic checking
    const interval = setInterval(checkVersion, checkInterval);

    return () => clearInterval(interval);
  }, [currentVersion, checkInterval]);

  const refreshApp = () => {
    // Clear service worker cache if available
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
    }
    window.location.reload();
  };

  const dismissPrompt = () => {
    setShowRefreshPrompt(false);
  };

  return {
    showRefreshPrompt,
    refreshApp,
    dismissPrompt
  };
};