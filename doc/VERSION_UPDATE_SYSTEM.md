# Version Update System Documentation

## Overview

The Buzz Portal implements an automatic version checking and update system that notifies users when a new version of the application is available. When clicked, the "Refresh" button triggers a comprehensive update process that ensures users get the latest features and bug fixes.

## Architecture Components

### 1. Version Information (`public/version.json`)

```json
{
  "version": 1769194924556,
  "commit": "dev"
}
```

- **version**: Unix timestamp-based version number (milliseconds since epoch)
- **commit**: Optional commit identifier or branch information

### 2. Version Check Hook (`src/hooks/useVersionCheck.ts`)

#### Key Features:
- Checks for new versions every 60 seconds by default
- Fetches `/version.json` with cache-busting headers
- Displays update prompt when version changes detected
- Handles the refresh process including service worker management

#### Complete Implementation:

```typescript
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
```

### 3. Update Prompt Component (`src/components/VersionUpdatePrompt.tsx`)

#### UI Implementation:

```typescript
import React from 'react';
import { useVersionCheck } from '../hooks/useVersionCheck';

export const VersionUpdatePrompt: React.FC = () => {
  const { showRefreshPrompt, refreshApp, dismissPrompt } = useVersionCheck();

  if (!showRefreshPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#007bff',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10000,
        maxWidth: '300px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        🔄 App Updated
      </div>
      <div style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.9 }}>
        A new version is available. Please refresh to get the latest features.
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={refreshApp}
          style={{
            backgroundColor: 'white',
            color: '#007bff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Refresh Now
        </button>
        <button
          onClick={dismissPrompt}
          style={{
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
};
```

### 4. Service Worker Integration (`public/sw.js`)

#### Cache Management and Update Handling:

```javascript
// Service Worker for Buzz Portal
// Handles cache invalidation and basic offline functionality

const CACHE_NAME = 'buzz-portal-v1';
const STATIC_CACHE_NAME = 'buzz-portal-static-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/favicon.ico',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('buzz-portal-'))
          .filter((cacheName) => cacheName !== STATIC_CACHE_NAME && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline, otherwise network first
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network first strategy for HTML files and API calls
  if (event.request.url.includes('.html') || event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
  } else {
    // Cache first strategy for static assets
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
    );
  }
});

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Skipping waiting and activating new version.');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('Service Worker: Clearing all caches.');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('Service Worker: Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      console.log('Service Worker: All caches cleared.');
    });
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: '1.0.0' });
  }
});

// Notify clients when a new service worker is available
self.addEventListener('controllerchange', () => {
  console.log('Service Worker: Controller changed, new version activated.');
});
```

## How the System Works

### Version Detection Flow

1. **Initial Load**: `useVersionCheck` hook fetches `/version.json` and stores the current version
2. **Periodic Checks**: Every 60 seconds, fetches `/version.json` again with cache-busting headers
3. **Version Comparison**: Compares new version with stored version
4. **Prompt Display**: If versions differ, shows the update prompt

### Refresh Process Flow

When "Refresh Now" is clicked:

1. **Service Worker Check**: Verifies if service worker is supported and registered
2. **Cache Clearing**: Sends `CLEAR_CACHE` message to service worker to delete all cached resources
3. **Service Worker Activation**:
   - If waiting service worker exists: Sends `SKIP_WAITING` message to activate immediately
   - Waits for `controllerchange` event or 2-second timeout
4. **Page Reload**: Calls `window.location.reload()` to fetch fresh resources
5. **Fallback**: If no service worker, just reloads the page directly

### Cache Management

The service worker implements two caching strategies:

- **Network First**: For HTML files and API calls (ensures fresh content)
- **Cache First**: For static assets (JS, CSS, images) for performance

### Update Prompt UI

- **Position**: Fixed top-right corner overlay
- **Styling**: Blue notification with white text and buttons
- **Actions**:
  - **Refresh Now**: Triggers the update process
  - **Later**: Dismisses the prompt (can be shown again on next version check)

## Deployment Considerations

### Version File Updates

The `version.json` file should be updated during deployment:

```bash
# Example deployment script
echo "{\"version\": $(date +%s%3N), \"commit\": \"$(git rev-parse --short HEAD)\"}" > public/version.json
```

### Cache Busting

The system uses multiple cache-busting techniques:
- HTTP headers: `Cache-Control: no-cache`, `Pragma: no-cache`
- Service worker cache clearing
- Hard page reload

### Browser Compatibility

- Service Worker API support required for full functionality
- Graceful fallback to simple page reload for unsupported browsers
- Works on all modern browsers (Chrome, Firefox, Safari, Edge)

## Error Handling

- Version fetch failures are logged but don't break the app
- Service worker unavailability falls back to simple reload
- 2-second timeout prevents hanging on service worker activation
- Network failures during cache clearing don't block the reload

## Performance Impact

- Minimal overhead: One HTTP request every 60 seconds
- Cache-busting ensures version accuracy
- Service worker caching improves subsequent loads
- Update process is fast (typically < 3 seconds)

## Troubleshooting

### Common Issues:

1. **Prompt not showing**: Check `version.json` is accessible and version number changed
2. **Refresh not working**: Check browser console for service worker errors
3. **Cache not clearing**: Verify service worker is registered and receiving messages
4. **Stuck on old version**: Hard refresh (Ctrl+F5) or clear browser cache manually

### Debug Information:

Enable verbose logging by checking browser console for:
- Version check attempts
- Service worker messages
- Cache clearing operations
- Controller change events