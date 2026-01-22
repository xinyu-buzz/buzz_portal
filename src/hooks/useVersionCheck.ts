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

  const refreshApp = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();

      if (registration) {
        // Clear service worker cache
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        }

        // If there's a waiting service worker, activate it
        if (registration.waiting) {
          console.log('Activating new service worker version.');
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Wait for the new service worker to take control
          return new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              console.log('New service worker activated, reloading page.');
              window.location.reload();
              resolve();
            }, { once: true });

            // Fallback timeout in case controllerchange doesn't fire
            setTimeout(() => {
              console.log('Controller change timeout, reloading page.');
              window.location.reload();
              resolve();
            }, 2000);
          });
        } else {
          // No waiting worker, just reload
          console.log('No waiting service worker, reloading page.');
          window.location.reload();
        }
      } else {
        // No service worker registration, just reload
        window.location.reload();
      }
    } else {
      // Service workers not supported, just reload
      window.location.reload();
    }
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