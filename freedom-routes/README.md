# Freedom Routes: Enslaved Cartographies & Mental Maps

An interactive data visualization exploring the hidden geographies of the Underground Railroad and the spatial knowledge systems used by enslaved people seeking freedom.

## Overview

This project reimagines the geography of freedom from below—visualizing the routes, landmarks, and "night knowledge" that enslaved people used to navigate their way to freedom. Rather than presenting fixed cartographic maps, this visualization treats the Underground Railroad as a **geography of feeling and spatial memory**, where routes existed in songs, stories, stars, and the landscape itself.

## Concept

### Research Focus

- **Coded Knowledge Systems**: How enslaved people navigated using rivers, trees, stars, and oral directions as encoded spatial information
- **Emotional Topography**: Visualizing routes not just as lines but as pulsing pathways of memory, fear, hope, and determination
- **Night Knowledge**: The practice of moving through darkness and moonlight as a form of liberation cartography
- **Embodied Geography**: Navigation knowledge held in the body, passed through song and story, never written down

### Historical Foundation

The narratives and navigation methods in this visualization are inspired by:
- WPA Slave Narratives Collection (Federal Writers' Project, 1936-1938)
- Oral histories documenting Underground Railroad routes
- Coded spirituals like "Follow the Drinking Gourd" and "Wade in the Water"
- Historical accounts of celestial navigation, natural landmarks, and safe houses

## Technical Implementation

### Technology Stack

- **React** - Component-based UI framework
- **react-map-gl** - Mapbox GL integration for base cartography
- **deck.gl** - WebGL-powered data visualization layers
- **luma.gl** - Custom shader effects for emotional topography
- **loaders.gl** - Efficient geospatial data loading
- **d3.js** - Data processing, scales, and geographic calculations
- **Vite** - Fast development and optimized builds

### Key Features

#### 1. Animated Route Visualization
Routes pulse with light intensity based on emotional topography data, creating a sense of routes as "veins of memory" rather than static lines.

```javascript
// Routes animate with emotional intensity
const pulseIntensity = Math.sin(time * Math.PI * 2) * 0.3 + 0.7;
getWidth: d => 3 + (intensity * 2 * pulseIntensity)
```

#### 2. Night Knowledge Mode
A dark map theme representing navigation under darkness, with routes appearing as moonlit pathways.

#### 3. Emotional Topography Layer
Hexagonal aggregation showing the "heat" of emotional intensity across the landscape—areas of high danger, hope, or significance.

#### 4. Landmark Visualization
- **Safe Houses**: Blue markers for Underground Railroad stations
- **Navigation Landmarks**: Teal markers for rivers, trees, mountain passes
- **Danger Zones**: Red markers for areas of high risk

#### 5. WPA Narrative Integration
Authentic historical narratives describing navigation methods, directions, and the experience of freedom-seeking.

## Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- A Mapbox access token (free tier available at [mapbox.com](https://www.mapbox.com))

### Installation

```bash
# Navigate to project directory
cd freedom-routes

# Install dependencies
npm install

# Set your Mapbox token in src/App.jsx
# Replace the MAPBOX_TOKEN constant with your token

# Start development server
npm run dev

# Build for production
npm run build
```

### Mapbox Token Setup

1. Sign up for a free Mapbox account at https://www.mapbox.com
2. Go to your Account → Tokens
3. Copy your default public token
4. In `src/App.jsx`, replace the placeholder token:
   ```javascript
   const MAPBOX_TOKEN = 'your-token-here';
   ```

## Project Structure

```
freedom-routes/
├── public/
│   └── data/
│       ├── routes.json          # Freedom route paths with metadata
│       ├── landmarks.json       # Safe houses, navigation markers
│       └── narratives.json      # WPA-inspired slave narratives
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   └── FreedomMap.jsx   # Main map + deck.gl visualization
│   │   └── Narrative/
│   │       └── NarrativePanel.jsx # Historical narrative display
│   ├── data/
│   │   └── processData.js       # d3.js data processing utilities
│   ├── styles/
│   │   └── main.css             # Application styles
│   ├── App.jsx                  # Main application component
│   └── main.jsx                 # Application entry point
├── docs/
│   └── ABOUT.md                 # Extended project documentation
├── index.html                   # HTML entry point
├── package.json
├── vite.config.js
└── README.md
```

## Data Structure

### Routes Data (`routes.json`)

GeoJSON FeatureCollection with LineString geometries:

```json
{
  "type": "Feature",
  "properties": {
    "id": "route-1",
    "name": "Mississippi to Ohio River Crossing",
    "emotionalIntensity": 0.9,
    "period": "1850s",
    "navigationMethod": "stars, rivers, moss on trees",
    "narrativeId": "narrative-1"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[lon, lat], ...]
  }
}
```

### Landmarks Data (`landmarks.json`)

GeoJSON FeatureCollection with Point geometries:

```json
{
  "type": "Feature",
  "properties": {
    "id": "landmark-1",
    "name": "Ohio River Crossing Point",
    "type": "river_crossing",
    "danger": "high",
    "description": "Where the drinking gourd points north",
    "symbolism": "River Jordan in spirituals"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [lon, lat]
  }
}
```

### Narratives Data (`narratives.json`)

Historical accounts and navigation descriptions:

```json
{
  "id": "narrative-1",
  "title": "Following the Drinking Gourd",
  "narrator": "Based on WPA Slave Narratives Collection",
  "text": "We traveled by night, always by night...",
  "navigationElements": ["North Star", "River currents", "Moss on trees"],
  "emotionalTone": "determined",
  "coordinates": [lon, lat]
}
```

## Visualization Controls

- **Night Knowledge Mode**: Toggle between dark (night navigation) and light map themes
- **Emotional Topography**: Show/hide the hexagonal heat map layer
- **Animation Speed**: Control the pulse and flow speed of routes (0.1x - 3x)
- **Narrative Selection**: Browse different WPA-inspired narratives

## d3.js Integration

The project uses d3.js for:

- **Geographic calculations**: Distance calculations using Haversine formula
- **Color scales**: Emotional intensity mapping to colors
- **Data aggregation**: Grouping landmarks by type and time period
- **Path interpolation**: Creating smooth animated transitions along routes
- **Statistical analysis**: Generating route statistics and distributions

Example usage:

```javascript
import { processRouteData, createEmotionalIntensityScale } from './data/processData';

const processedRoutes = processRouteData(routes);
const { colorScale, sizeScale } = createEmotionalIntensityScale();
```

## deck.gl Layers

1. **PathLayer**: Animated freedom routes with pulsing width and opacity
2. **ScatterplotLayer**: Landmark points with type-based coloring
3. **HexagonLayer**: Emotional topography aggregation

## Extending the Data

To add new routes, landmarks, or narratives:

1. Edit the JSON files in `public/data/`
2. Follow the existing data structure
3. For narratives, include:
   - Historical context (period, location)
   - Navigation methods used
   - Emotional tone
   - Geographic coordinates for map linking

## Performance Optimization

- **WebGL rendering**: All visualizations use GPU-accelerated deck.gl layers
- **Data loading**: Uses loaders.gl for efficient geospatial data parsing
- **Animation**: RequestAnimationFrame-based time loop for smooth 60fps
- **Build optimization**: Vite for fast HMR and optimized production builds

## Educational Use

This visualization is designed for:

- **Digital humanities courses**: Exploring spatial history and counter-cartography
- **Data visualization education**: WebGL, geospatial viz, narrative integration
- **Historical education**: Understanding Underground Railroad navigation
- **Critical geography**: Examining maps from marginalized perspectives

## Further Research

Potential expansions:
- Integration of additional WPA narratives
- Seasonal route variations (spring/summer/fall/winter)
- Sound integration (spirituals, natural sounds)
- VR/AR experiences of night navigation
- Comparative analysis with official period maps

## Credits & Inspiration

- WPA Slave Narratives Collection (Library of Congress)
- *Follow the Drinking Gourd* and other coded spirituals
- Contemporary scholarship on counter-cartography and spatial justice
- Digital humanities projects exploring hidden histories

## License

MIT License - See LICENSE file for details

## Contact

Created by Taylor Watson
Email: taylorwatsonb@gmail.com
Part of Technical Writing Portfolio

---

*This project honors the memory and resilience of those who risked everything for freedom, and the invaluable knowledge systems they created and preserved.*
