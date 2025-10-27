import React, { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl';
import { DeckGL } from '@deck.gl/react';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { HexagonLayer } from '@deck.gl/aggregation-layers';

const INITIAL_VIEW_STATE = {
  longitude: -85.0,
  latitude: 37.0,
  zoom: 5.5,
  pitch: 0,
  bearing: 0
};

// Night mode (dark) map style
const NIGHT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
// Day mode map style
const DAY_MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

function FreedomMap({
  mapboxToken,
  routes,
  landmarks,
  nightMode,
  animationSpeed,
  showEmotionalTopography,
  onRouteClick
}) {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [time, setTime] = useState(0);
  const [hoveredObject, setHoveredObject] = useState(null);

  // Animation loop for pulsing effects
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(t => (t + 0.01 * animationSpeed) % 1);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [animationSpeed]);

  // Create route layers with animation
  const routeLayers = useMemo(() => {
    if (!routes || routes.length === 0) return [];

    return routes.map((route, index) => {
      const intensity = route.properties.emotionalIntensity || 0.5;
      const baseColor = [255, 215, 0]; // Gold color
      const pulseIntensity = Math.sin(time * Math.PI * 2 + index * 0.5) * 0.3 + 0.7;

      return new PathLayer({
        id: `route-${route.properties.id}`,
        data: [route],
        getPath: d => d.geometry.coordinates,
        getColor: d => [
          baseColor[0],
          baseColor[1],
          baseColor[2],
          Math.floor(255 * intensity * pulseIntensity * 0.6)
        ],
        getWidth: d => 3 + (intensity * 2 * pulseIntensity),
        widthMinPixels: 2,
        widthMaxPixels: 8,
        pickable: true,
        onClick: info => {
          if (info.object && onRouteClick) {
            onRouteClick(info.object);
          }
        },
        onHover: info => setHoveredObject(info.object),
        updateTriggers: {
          getColor: [time, intensity],
          getWidth: [time, intensity]
        }
      });
    });
  }, [routes, time, onRouteClick]);

  // Create landmark layers
  const landmarkLayers = useMemo(() => {
    if (!landmarks || landmarks.length === 0) return [];

    const getLandmarkColor = (type, danger) => {
      if (type === 'safe_house') return [74, 158, 255]; // Blue
      if (danger === 'high') return [255, 107, 107]; // Red
      return [78, 205, 196]; // Teal
    };

    return new ScatterplotLayer({
      id: 'landmarks',
      data: landmarks,
      getPosition: d => d.geometry.coordinates,
      getRadius: d => {
        const basePulse = Math.sin(time * Math.PI * 2) * 0.2 + 0.8;
        return 1000 * basePulse;
      },
      getColor: d => {
        const color = getLandmarkColor(d.properties.type, d.properties.danger);
        const pulse = Math.sin(time * Math.PI * 2) * 0.3 + 0.7;
        return [...color, Math.floor(200 * pulse)];
      },
      radiusMinPixels: 5,
      radiusMaxPixels: 15,
      pickable: true,
      onHover: info => setHoveredObject(info.object),
      updateTriggers: {
        getRadius: [time],
        getColor: [time]
      }
    });
  }, [landmarks, time]);

  // Create emotional topography layer (heat map effect)
  const emotionalTopographyLayer = useMemo(() => {
    if (!showEmotionalTopography || !routes || routes.length === 0) return null;

    // Extract all points from routes with their emotional intensity
    const points = [];
    routes.forEach(route => {
      const intensity = route.properties.emotionalIntensity || 0.5;
      route.geometry.coordinates.forEach(coord => {
        points.push({
          coordinates: coord,
          intensity: intensity
        });
      });
    });

    return new HexagonLayer({
      id: 'emotional-topography',
      data: points,
      getPosition: d => d.coordinates,
      getElevationWeight: d => d.intensity,
      elevationScale: 0,
      radius: 50000,
      coverage: 0.8,
      opacity: 0.15,
      pickable: false,
      colorRange: [
        [255, 215, 0, 50],   // Gold - low intensity
        [255, 165, 0, 100],  // Orange - medium
        [255, 140, 0, 150],  // Dark orange - high
        [255, 69, 0, 200]    // Red-orange - very high
      ]
    });
  }, [routes, showEmotionalTopography]);

  // Combine all layers
  const layers = [
    emotionalTopographyLayer,
    ...routeLayers,
    landmarkLayers
  ].filter(Boolean);

  return (
    <div className="map-container">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
      >
        <Map
          mapboxAccessToken={mapboxToken}
          mapStyle={nightMode ? NIGHT_MAP_STYLE : DAY_MAP_STYLE}
        />
      </DeckGL>

      {hoveredObject && (
        <div
          className="map-tooltip"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="tooltip-title">
            {hoveredObject.properties?.name || 'Unknown'}
          </div>
          <div className="tooltip-content">
            {hoveredObject.properties?.description || ''}
          </div>
        </div>
      )}
    </div>
  );
}

export default FreedomMap;
