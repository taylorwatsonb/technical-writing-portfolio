import React, { useState } from 'react';

function NarrativePanel({ narrative, narratives, onSelectNarrative }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!narrative) {
    return null;
  }

  return (
    <div className={`narrative-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="toggle-narrative"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        {isCollapsed ? '▲' : '▼'}
      </button>

      <h3>{narrative.title}</h3>

      {!isCollapsed && (
        <>
          <div className="narrator">{narrative.narrator}</div>
          <div className="location-period">
            {narrative.location} • {narrative.period}
          </div>

          <div className="narrative-text">
            {narrative.text}
          </div>

          {narrative.navigationElements && narrative.navigationElements.length > 0 && (
            <div className="navigation-elements">
              <h4>Navigation Methods</h4>
              <ul>
                {narrative.navigationElements.map((element, index) => (
                  <li key={index}>{element}</li>
                ))}
              </ul>
            </div>
          )}

          {narratives && narratives.length > 1 && (
            <div className="narrative-selector" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <select
                value={narrative.id}
                onChange={(e) => {
                  const selected = narratives.find(n => n.id === e.target.value);
                  if (selected) onSelectNarrative(selected);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                {narratives.map(n => (
                  <option key={n.id} value={n.id} style={{ background: '#1a1a1a' }}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default NarrativePanel;
