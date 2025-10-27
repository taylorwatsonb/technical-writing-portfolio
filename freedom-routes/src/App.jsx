import React, { useState, useEffect } from 'react';
import FreedomMap from './components/Map/FreedomMap';
import NarrativePanel from './components/Narrative/NarrativePanel';

// You'll need to get a Mapbox token - for demo purposes, this can be set to your own token
// Sign up at https://www.mapbox.com/ and get a free token
const MAPBOX_TOKEN = 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example'; // Replace with your token

function App() {
  const [routes, setRoutes] = useState([]);
  const [landmarks, setLandmarks] = useState([]);
  const [narratives, setNarratives] = useState([]);
  const [selectedNarrative, setSelectedNarrative] = useState(null);
  const [nightMode, setNightMode] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const [showEmotionalTopography, setShowEmotionalTopography] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load data
    const loadData = async () => {
      try {
        const [routesRes, landmarksRes, narrativesRes] = await Promise.all([
          fetch('/data/routes.json'),
          fetch('/data/landmarks.json'),
          fetch('/data/narratives.json')
        ]);

        const routesData = await routesRes.json();
        const landmarksData = await landmarksRes.json();
        const narrativesData = await narrativesRes.json();

        setRoutes(routesData.features);
        setLandmarks(landmarksData.features);
        setNarratives(narrativesData.narratives);

        // Set first narrative as default
        if (narrativesData.narratives.length > 0) {
          setSelectedNarrative(narrativesData.narratives[0]);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleRouteClick = (route) => {
    // Find associated narrative
    const narrative = narratives.find(n => n.id === route.properties.narrativeId);
    if (narrative) {
      setSelectedNarrative(narrative);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">Loading Freedom Routes...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>FREEDOM ROUTES</h1>
        <div className="subtitle">Enslaved Cartographies & Mental Maps of Freedom</div>
      </header>

      <FreedomMap
        mapboxToken={MAPBOX_TOKEN}
        routes={routes}
        landmarks={landmarks}
        nightMode={nightMode}
        animationSpeed={animationSpeed}
        showEmotionalTopography={showEmotionalTopography}
        onRouteClick={handleRouteClick}
      />

      <NarrativePanel
        narrative={selectedNarrative}
        narratives={narratives}
        onSelectNarrative={setSelectedNarrative}
      />

      <div className="controls-panel">
        <h3>Visualization Controls</h3>

        <div className="control-group">
          <label>Night Knowledge Mode</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={nightMode}
              onChange={(e) => setNightMode(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="control-group">
          <label>Emotional Topography</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showEmotionalTopography}
              onChange={(e) => setShowEmotionalTopography(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="control-group">
          <label>Animation Speed</label>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={animationSpeed}
            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
          />
          <div className="value-display">{animationSpeed.toFixed(1)}x</div>
        </div>
      </div>

      <div className="legend">
        <h4>Legend</h4>
        <div className="legend-item">
          <div className="legend-symbol route"></div>
          <span>Freedom Routes</span>
        </div>
        <div className="legend-item">
          <div className="legend-symbol safe-house"></div>
          <span>Safe Houses</span>
        </div>
        <div className="legend-item">
          <div className="legend-symbol landmark"></div>
          <span>Navigation Landmarks</span>
        </div>
        <div className="legend-item">
          <div className="legend-symbol danger"></div>
          <span>Danger Zones</span>
        </div>
      </div>
    </div>
  );
}

export default App;
