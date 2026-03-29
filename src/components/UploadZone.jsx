import { useRef, useState } from 'react';

export default function UploadZone({ onFile, status, errorMsg, onRetry }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const isLoading = status === 'loading';
  const isError   = status === 'error';

  function openPicker() {
    if (!isLoading) inputRef.current?.click();
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // reset so the same file can be re-selected
    e.target.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!isLoading) setIsDragging(true);
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  let zoneClass = 'upload-zone';
  if (isDragging)  zoneClass += ' upload-zone--dragging';
  if (isLoading)   zoneClass += ' upload-zone--loading';

  return (
    <div
      className={zoneClass}
      onClick={!isError ? openPicker : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={isLoading ? -1 : 0}
      aria-label="Upload audio file"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a,.aif,.aiff,.opus"
        onChange={handleFileInput}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {isLoading && <LoadingState />}
      {isError   && <ErrorState msg={errorMsg} onRetry={onRetry} />}
      {!isLoading && !isError && <IdleState isDragging={isDragging} />}
    </div>
  );
}

function IdleState({ isDragging }) {
  return (
    <>
      <WaveformIcon className="upload-zone__icon" />
      <p className="upload-zone__title">
        {isDragging ? 'Drop it here' : 'Drop your audio file here'}
      </p>
      <p className="upload-zone__sub">
        or <span className="upload-zone__link">click to browse</span>
      </p>
      <p className="upload-zone__formats">MP3 · WAV · FLAC · AIFF · OGG · AAC · M4A</p>
    </>
  );
}

function LoadingState() {
  return (
    <>
      <div className="spinner" aria-hidden="true" />
      <p className="upload-zone__loading-text">Analysing audio…</p>
    </>
  );
}

function ErrorState({ msg, onRetry }) {
  return (
    <div className="upload-zone__error">
      <AlertIcon className="upload-zone__error-icon" />
      <p className="upload-zone__error-msg">{msg}</p>
      <button
        className="upload-zone__retry"
        onClick={e => { e.stopPropagation(); onRetry(); }}
      >
        Try another file
      </button>
    </div>
  );
}

function WaveformIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="4"  y="18" width="6" height="12" rx="3" fill="currentColor" opacity=".5" />
      <rect x="13" y="10" width="6" height="28" rx="3" fill="currentColor" opacity=".7" />
      <rect x="22" y="4"  width="6" height="40" rx="3" fill="currentColor" />
      <rect x="31" y="10" width="6" height="28" rx="3" fill="currentColor" opacity=".7" />
      <rect x="40" y="18" width="6" height="12" rx="3" fill="currentColor" opacity=".5" />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
