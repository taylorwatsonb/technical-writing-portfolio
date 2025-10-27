import * as d3 from 'd3';

/**
 * Process route data to calculate distances and emotional intensities
 * Uses d3-geo for geographic calculations
 */
export function processRouteData(routes) {
  return routes.map(route => {
    const coords = route.geometry.coordinates;
    const distances = [];
    let totalDistance = 0;

    // Calculate distances between waypoints
    for (let i = 1; i < coords.length; i++) {
      const dist = calculateDistance(coords[i - 1], coords[i]);
      distances.push(dist);
      totalDistance += dist;
    }

    return {
      ...route,
      properties: {
        ...route.properties,
        distances,
        totalDistance,
        waypointCount: coords.length
      }
    };
  });
}

/**
 * Calculate distance between two geographic coordinates (Haversine formula)
 * Returns distance in miles
 */
export function calculateDistance([lon1, lat1], [lon2, lat2]) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Create a scale for emotional intensity visualization
 * Maps intensity values (0-1) to colors and sizes
 */
export function createEmotionalIntensityScale() {
  return {
    colorScale: d3
      .scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateRgb('#FFD700', '#FF4500')),

    sizeScale: d3
      .scaleLinear()
      .domain([0, 1])
      .range([2, 8]),

    opacityScale: d3
      .scaleLinear()
      .domain([0, 1])
      .range([0.3, 0.9])
  };
}

/**
 * Aggregate landmarks by type
 * Returns counts and geographic distribution
 */
export function aggregateLandmarksByType(landmarks) {
  const byType = d3.rollup(
    landmarks,
    v => ({
      count: v.length,
      avgLat: d3.mean(v, d => d.geometry.coordinates[1]),
      avgLon: d3.mean(v, d => d.geometry.coordinates[0]),
      items: v
    }),
    d => d.properties.type
  );

  return Array.from(byType, ([type, data]) => ({ type, ...data }));
}

/**
 * Calculate temporal distribution of routes
 * Groups routes by time period
 */
export function calculateTemporalDistribution(routes) {
  const byPeriod = d3.rollup(
    routes,
    v => v.length,
    d => d.properties.period
  );

  return Array.from(byPeriod, ([period, count]) => ({ period, count }));
}

/**
 * Create a hexbin aggregation for emotional topography
 * Groups nearby points and averages their emotional intensity
 */
export function createEmotionalHexbins(routes, radius = 50) {
  const points = [];

  routes.forEach(route => {
    const intensity = route.properties.emotionalIntensity || 0.5;
    route.geometry.coordinates.forEach(coord => {
      points.push({
        x: coord[0],
        y: coord[1],
        intensity: intensity
      });
    });
  });

  // Use d3-hexbin if needed for more sophisticated aggregation
  // For now, return processed points
  return points;
}

/**
 * Interpolate along a route path
 * Returns evenly spaced points along the route for smooth animation
 */
export function interpolateRoutePath(coordinates, numPoints = 100) {
  const path = [];
  const totalSegments = coordinates.length - 1;

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const segmentIndex = Math.min(
      Math.floor(t * totalSegments),
      totalSegments - 1
    );
    const segmentT = (t * totalSegments) - segmentIndex;

    const start = coordinates[segmentIndex];
    const end = coordinates[segmentIndex + 1];

    const interpolated = [
      d3.interpolateNumber(start[0], end[0])(segmentT),
      d3.interpolateNumber(start[1], end[1])(segmentT)
    ];

    path.push(interpolated);
  }

  return path;
}

/**
 * Calculate bounding box for all routes
 * Useful for fitting the map view
 */
export function calculateBoundingBox(routes) {
  const allCoords = routes.flatMap(r => r.geometry.coordinates);

  return {
    minLon: d3.min(allCoords, d => d[0]),
    maxLon: d3.max(allCoords, d => d[0]),
    minLat: d3.min(allCoords, d => d[1]),
    maxLat: d3.max(allCoords, d => d[1])
  };
}

/**
 * Generate statistics about the routes
 */
export function generateRouteStatistics(routes) {
  const processedRoutes = processRouteData(routes);

  return {
    totalRoutes: routes.length,
    totalDistance: d3.sum(processedRoutes, r => r.properties.totalDistance),
    avgDistance: d3.mean(processedRoutes, r => r.properties.totalDistance),
    avgEmotionalIntensity: d3.mean(routes, r => r.properties.emotionalIntensity),
    periods: [...new Set(routes.map(r => r.properties.period))],
    navigationMethods: [...new Set(routes.map(r => r.properties.navigationMethod))]
  };
}

export default {
  processRouteData,
  calculateDistance,
  createEmotionalIntensityScale,
  aggregateLandmarksByType,
  calculateTemporalDistribution,
  createEmotionalHexbins,
  interpolateRoutePath,
  calculateBoundingBox,
  generateRouteStatistics
};
