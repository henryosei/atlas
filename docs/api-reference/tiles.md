---
sidebar_position: 2
---

# Tiles

Atlas serves Protomaps vector tiles in Mapbox Vector Tile (MVT) format from PMTiles archives.

## Get a vector tile

```
GET /v1/tiles/{tileset}/{z}/{x}/{y}.mvt
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tileset` | string | Tileset name (e.g., `ghana`, `nigeria`, `kenya`) |
| `z` | integer | Zoom level (0–15) |
| `x` | integer | Tile column |
| `y` | integer | Tile row |

### Response

Binary MVT data (`Content-Type: application/vnd.mapbox-vector-tile`).

Tiles are cached with `Cache-Control: public, max-age=86400`.

### Example

```bash
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/tiles/ghana/12/2048/2048.mvt" \
  --output tile.mvt
```

## Get TileJSON metadata

```
GET /v1/tiles/{tileset}/tilejson.json
```

Returns a [TileJSON 3.0](https://github.com/mapbox/tilejson-spec) document describing the tileset. This is what you pass as the `url` field in MapLibre's vector source configuration, or directly as the map `style` for a complete Protomaps basemap.

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tileset` | string | Tileset name |

### Response

```json
{
  "tilejson": "3.0.0",
  "name": "ghana",
  "tiles": [
    "https://api.atlas-maps.dev/v1/tiles/ghana/{z}/{x}/{y}.mvt"
  ],
  "minzoom": 0,
  "maxzoom": 15,
  "bounds": [-3.26, 4.74, 1.20, 11.17],
  "center": [-1.03, 7.95, 7]
}
```

### Example — MapLibre GL JS

```javascript
const ATLAS_URL = 'https://api.atlas-maps.dev';
const API_KEY = 'your-api-key';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      atlas: {
        type: 'vector',
        url: `${ATLAS_URL}/v1/tiles/ghana/tilejson.json`,
        headers: { 'X-API-Key': API_KEY }
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f4f0' }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'atlas',
        'source-layer': 'water',
        paint: { 'fill-color': '#a8d8ea' }
      },
      {
        id: 'roads',
        type: 'line',
        source: 'atlas',
        'source-layer': 'roads',
        paint: { 'line-color': '#ffffff', 'line-width': 2 }
      }
    ]
  },
  center: [-0.187, 5.603],
  zoom: 12
});
```

### Example — Protomaps basemap style

The easiest way to get a complete styled basemap is to use the `@protomaps/basemaps` package:

```javascript
import { layersWithConfig } from '@protomaps/basemaps';

const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      atlas: {
        type: 'vector',
        url: `${ATLAS_URL}/v1/tiles/ghana/tilejson.json`
      }
    },
    layers: layersWithConfig({ theme: 'light' })
  }
});
```

### Example — Self-hosted

```bash
curl "http://localhost:3001/v1/tiles/ghana/tilejson.json"
```
