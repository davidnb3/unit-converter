import { useState, useEffect } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import UploadZone from './components/UploadZone.jsx';
import ResultCard from './components/ResultCard.jsx';
import { detectKey } from './lib/keyDetector.js';

function getInitialTheme() {
  const stored = localStorage.getItem('kf-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error'
  const [result, setResult] = useState(null);   // { key, mode, camelot, filename }
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kf-theme', theme);

    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#1A1714' : '#E8E2DA');
    }
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  }

  async function handleFile(file) {
    if (!file) return;

    setStatus('loading');
    setResult(null);
    setErrorMsg('');

    // Allow the loading state to render before blocking computation
    await new Promise(resolve => setTimeout(resolve, 60));

    try {
      const detection = await detectKey(file);
      setResult({ ...detection, filename: file.name });
      setStatus('idle');
    } catch (err) {
      setErrorMsg(err.message || 'Could not analyse the audio file.');
      setStatus('error');
    }
  }

  function handleReset() {
    setResult(null);
    setStatus('idle');
    setErrorMsg('');
  }

  return (
    <div className="app">
      <header className="header">
        <span className="brand">KIN</span>
        <h1 className="title">KeyFinder</h1>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="main">
        {result ? (
          <ResultCard result={result} onReset={handleReset} onFile={handleFile} />
        ) : (
          <UploadZone
            onFile={handleFile}
            status={status}
            errorMsg={errorMsg}
            onRetry={handleReset}
          />
        )}
      </main>
    </div>
  );
}
