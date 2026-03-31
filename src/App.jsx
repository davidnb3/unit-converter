import { useState, useEffect, useCallback } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import { CATEGORIES, ROW_GROUPS, formatValue } from './lib/units.js';

function getInitialTheme() {
  const stored = localStorage.getItem('kin-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const catMap = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [catValues, setCatValues] = useState(() =>
    Object.fromEntries(CATEGORIES.map(c => [c.id, {}]))
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kin-theme', theme);
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1A1714' : '#E8E2DA');
  }, [theme]);

  const handleChange = useCallback((catId, unitId, raw) => {
    const cat = catMap[catId];
    const unit = cat.units.find(u => u.id === unitId);

    // Empty or just a minus sign — clear the whole category
    if (raw === '' || raw === '-') {
      setCatValues(prev => ({
        ...prev,
        [catId]: raw === '-' ? { [unitId]: '-' } : {},
      }));
      return;
    }

    const num = parseFloat(raw);
    if (isNaN(num)) {
      setCatValues(prev => ({ ...prev, [catId]: { [unitId]: raw } }));
      return;
    }

    const baseVal = unit.toBase(num);
    const newVals = {};
    for (const u of cat.units) {
      newVals[u.id] = u.id === unitId ? raw : formatValue(u.fromBase(baseVal));
    }
    setCatValues(prev => ({ ...prev, [catId]: newVals }));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="header__inner">
          <a href="https://kintools.net" className="header__brand" aria-label="Kin tools">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9h14M14 5l4 4-4 4" />
              <path d="M21 15H7M10 11l-4 4 4 4" />
            </svg>
          </a>
          <h1 className="header__title">Unit Converter</h1>
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
          />
        </div>
      </header>

      <main className="converter">
        {ROW_GROUPS.map((group, rowIdx) => (
          <div key={rowIdx} className="converter__row">
            {group.map(catId => {
              const cat = catMap[catId];
              return (
                <section key={catId} className="category">
                  <div className="category__header">{cat.label}</div>
                  {cat.units.map(unit => (
                    <div key={unit.id} className="unit-row">
                      <span className="unit-row__symbol" title={unit.label}>
                        {unit.symbol}
                      </span>
                      <input
                        className="unit-row__input"
                        type="number"
                        inputMode="decimal"
                        placeholder="—"
                        value={catValues[catId][unit.id] ?? ''}
                        onChange={e => handleChange(catId, unit.id, e.target.value)}
                        aria-label={`${unit.label} (${unit.symbol})`}
                      />
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        ))}
      </main>
    </div>
  );
}
