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