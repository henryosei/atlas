---
sidebar_position: 1
---

# JavaScript

Integrate Atlas into any web page using vanilla JavaScript and MapLibre GL JS.

## Setup

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
  <style>
    body { margin: 0; }
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
  <script>
    const ATLAS_URL = 'https://api.atlas-maps.dev'; // or your self-hosted URL
    const API_KEY = 'your-api-key';
  </script>
</body>
</html>
```

## Show a map

```javascript
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      atlas: {
        type: 'vector',
        url: `${ATLAS_URL}/v1/tiles/ghana/tilejson.json`
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'water', type: 'fill', source: 'atlas', 'source-layer': 'water', paint: { 'fill-color': '#a8d8ea' } },
      { id: 'buildings', type: 'fill', source: 'atlas', 'source-layer': 'buildings', paint: { 'fill-color': '#e8e0d8', 'fill-opacity': 0.8 } },
      { id: 'roads-minor', type: 'line', source: 'atlas', 'source-layer': 'roads', filter: ['!=', ['get', 'highway'], 'primary'], paint: { 'line-color': '#ffffff', 'line-width': 1.5 } },
      { id: 'roads-major', type: 'line', source: 'atlas', 'source-layer': 'roads', filter: ['==', ['get', 'highway'], 'primary'], paint: { 'line-color': '#ffffff', 'line-width': 3 } },
      { id: 'labels', type: 'symbol', source: 'atlas', 'source-layer': 'places', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 } }
    ]
  },
  center: [-0.187, 5.603],
  zoom: 12
});
```

For a complete basemap without manual layer configuration, use the `@protomaps/basemaps` package:

```html
<script src="https://unpkg.com/@protomaps/basemaps/dist/basemaps.js"></script>
<script>
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: { atlas: { type: 'vector', url: `${ATLAS_URL}/v1/tiles/ghana/tilejson.json` } },
      layers: protomapsBasemaps.layersWithConfig({ theme: 'light' })
    },
    center: [-0.187, 5.603],
    zoom: 12
  });
</script>
```

## Geocode an address

```javascript
async function geocode(query, options = {}) {
  const params = new URLSearchParams({ q: query });
  if (options.limit) params.set('limit', String(options.limit));
  if (options.country) params.set('country', options.country);
  if (options.lat != null) params.set('lat', String(options.lat));
  if (options.lon != null) params.set('lon', String(options.lon));

  const response = await fetch(`${ATLAS_URL}/v1/geocode?${params}`, {
    headers: { 'X-API-Key': API_KEY }
  });

  if (!response.ok) throw new Error(`Geocode failed: ${response.status}`);
  const data = await response.json();
  return data.results;
}

const results = await geocode('Makola Market', { limit: 5 });
if (results.length > 0) {
  const place = results[0];
  new maplibregl.Marker()
    .setLngLat([place.lon, place.lat])
    .setPopup(new maplibregl.Popup().setHTML(`<strong>${place.name}</strong><br>${place.address ?? ''}`))
    .addTo(map);
  map.flyTo({ center: [place.lon, place.lat], zoom: 15 });
}
```

## Reverse geocode coordinates

```javascript
async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const response = await fetch(`${ATLAS_URL}/v1/reverse?${params}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  if (!response.ok) throw new Error(`Reverse geocode failed: ${response.status}`);
  const data = await response.json();
  return data.results[0] ?? null;
}

map.on('click', async (e) => {
  const place = await reverseGeocode(e.lngLat.lat, e.lngLat.lng);
  if (place) {
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${place.name}</strong>`)
      .addTo(map);
  }
});
```

## Get a route

```javascript
async function getRoute(origin, destination, profile = 'car') {
  const response = await fetch(`${ATLAS_URL}/v1/route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({ origin, destination, profile })
  });
  if (!response.ok) throw new Error(`Route failed: ${response.status}`);
  return response.json();
}

async function drawRoute(origin, destination) {
  const route = await getRoute(origin, destination, 'car');

  if (map.getSource('route')) {
    map.removeLayer('route-line');
    map.removeSource('route');
  }

  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', properties: {}, geometry: route.geometry }
  });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#0066cc', 'line-width': 4 }
  });

  const km = (route.distance_m / 1000).toFixed(1);
  const min = Math.round(route.duration_s / 60);
  console.log(`Route: ${km} km, ~${min} min`);
}

await drawRoute(
  { lat: 5.603, lon: -0.187 },
  { lat: 5.614, lon: -0.220 }
);
```

## Search for places nearby

```javascript
async function searchNearby(query, lat, lon, options = {}) {
  const params = new URLSearchParams({ q: query, lat: String(lat), lon: String(lon) });
  if (options.category) params.set('category', options.category);
  if (options.radius_km) params.set('radius_km', String(options.radius_km));
  if (options.limit) params.set('limit', String(options.limit));

  const response = await fetch(`${ATLAS_URL}/v1/search?${params}`, {
    headers: { 'X-API-Key': API_KEY }
  });
  if (!response.ok) throw new Error(`Search failed: ${response.status}`);
  const data = await response.json();
  return data.results;
}

const hospitals = await searchNearby('hospital', 5.6, -0.2, {
  category: 'hospital',
  radius_km: 5
});

hospitals.forEach(place => {
  new maplibregl.Marker({ color: '#cc0000' })
    .setLngLat([place.lon, place.lat])
    .setPopup(new maplibregl.Popup().setHTML(`
      <strong>${place.name}</strong><br>
      ${place.address ?? ''}<br>
      ${place.distance_m != null ? `${(place.distance_m / 1000).toFixed(1)} km away` : ''}
    `))
    .addTo(map);
});
```

## Report a map issue

```javascript
async function reportIssue(origin, destination, profile, issueType, description = '') {
  const response = await fetch(`${ATLAS_URL}/v1/contribute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      route_origin: origin,
      route_destination: destination,
      profile,
      issue_type: issueType,
      description
    })
  });
  if (!response.ok) throw new Error(`Contribution failed: ${response.status}`);
  return response.json();
}

const { id } = await reportIssue(
  { lat: 5.603, lon: -0.187 },
  { lat: 5.614, lon: -0.220 },
  'car',
  'road_flooded',
  'Flooding near Tema Station'
);
console.log('Reported:', id);
```

## Self-hosted configuration

Replace `ATLAS_URL` with your server's address:

```javascript
const ATLAS_URL = 'http://localhost:3001'; // local dev
const ATLAS_URL = 'https://maps.yourcompany.com'; // production
```

When `ATLAS_AUTH_ENABLED=false`, omit the `X-API-Key` header or leave it empty.
