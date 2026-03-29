import { useState } from 'react';

export default function ResultCard({ result, onReset, onFile }) {
  const { key, mode, camelot, filename } = result;
  const displayMode = mode === 'major' ? 'Major' : 'Minor';
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`result-card${isDragging ? ' result-card--dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="result-card__label">Detected Key</p>

      <div className="result-card__body">
        <div className="result-card__key">
          <span className="result-card__note">{key}</span>
          <span className="result-card__mode">{displayMode}</span>
        </div>

        <div className="result-card__camelot">
          <span className="result-card__camelot-label">Camelot</span>
          <span className="result-card__camelot-badge">{camelot}</span>
        </div>
      </div>

      {isDragging && (
        <div className="result-card__drop-hint">
          Drop to analyse
        </div>
      )}

      <div className="result-card__divider" />

      {filename && (
        <div className="result-card__filename">
          <MusicIcon className="result-card__filename-icon" />
          <span className="result-card__filename-text" title={filename}>{filename}</span>
        </div>
      )}

      <button className="result-card__reset" onClick={onReset}>
        Analyse another file
      </button>
    </div>
  );
}

function MusicIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6"  cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
