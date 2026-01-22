import React from 'react';

interface PdfViewerProps {
  url: string;
  title?: string;
  onLoad?: () => void;
}

export default function PdfViewer({ url, title, onLoad }: PdfViewerProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f3f4f6'
    }}>
      <div style={{ textAlign: 'center', padding: '32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          backgroundColor: '#d1d5db',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '32px', color: '#6b7280' }}>📄</span>
        </div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '500',
          color: '#111827',
          marginBottom: '8px'
        }}>
          {title || 'PDF Document'}
        </h3>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>
          PDF viewer not available in preview mode
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'background-color 0.2s'
          }}
          onClick={onLoad}
        >
          <span>🔗</span>
          Open PDF
        </a>
      </div>
    </div>
  );
}