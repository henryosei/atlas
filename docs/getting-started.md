---
sidebar_position: 1
---

# Getting Started

Atlas is a maps platform built for Africa. It provides vector tile serving, geocoding, routing, and POI search with first-class support for African road networks, languages, and addressing patterns.

## What Atlas gives you

- **Vector tiles** — PMTiles-based map rendering via MapLibre GL
- **Geocoding** — Forward and reverse geocoding with landmark-relative addressing ("near the MTN mast")
- **Routing** — Turn-by-turn navigation across 4 profiles: car, motorcycle, bicycle, foot
- **Place search** — POI discovery with distance scoring and category filtering
- **Community corrections** — Users report wrong turns, road closures, bad conditions
- **Trip telemetry** — Collect GPS traces to improve ETAs over time (opt-in)

## Hosted vs. self-hosted

**Hosted API** (`https://api.atlas-maps.dev`): Sign up for an API key and start building immediately. No infrastructure to manage.

**Self-hosted**: Run Atlas on your own servers. Full control over data, no per-request costs. See [Self-Hosting](self-hosting.md).

## Quick start (3 minutes)

### 1. Get an API key

Sign up at [atlas-maps.dev](https://atlas-maps.dev) to get a free API key. For self-hosted deployments, set `ATLAS_AUTH_ENABLED=false` to skip auth during development.

### 2. Show your first map

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl/dist/maplibre-gl.css" />
  <style>
    #map { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
  <script>
    const ATLAS_URL = 'https://api.atlas-maps.dev';
    const API_KEY = 'your-api-key';

    const map = new maplibregl.Map({
      container: 'map',
      style: `${ATLAS_URL}/v1/tiles/ghana/tilejson.json?key=${API_KEY}`,
      center: [-0.187, 5.603],
      zoom: 12
    });
  </script>
</body>
</html>
```

### 3. Geocode an address

```javascript
const response = await fetch(
  `${ATLAS_URL}/v1/geocode?q=Makola+Market&limit=5`,
  { headers: { 'X-API-Key': API_KEY } }
);
const { results } = await response.json();
console.log(results[0]);
// { name: "Makola Market", lat: 5.549, lon: -0.213, category: "marketplace", confidence: 0.97 }
```

### 4. Get a route

```javascript
const response = await fetch(`${ATLAS_URL}/v1/route`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    origin: { lat: 5.603, lon: -0.187 },
    destination: { lat: 6.688, lon: -1.624 },
    profile: 'car'
  })
});
const route = await response.json();
console.log(`${(route.distance_m / 1000).toFixed(1)} km, ${Math.round(route.duration_s / 60)} min`);
```

## Next steps

- [API Reference](api-reference/overview.md) — Full endpoint documentation
- [JavaScript SDK Guide](sdk/javascript.md) — MapLibre integration with Atlas
- [React Guide](sdk/react.md) — React hooks and map components
- [React Native Guide](sdk/react-native.md) — Mobile apps with GPS tracking
