---
sidebar_position: 2
---

# React

React hooks and components for Atlas maps, geocoding, routing, and place search.

## Installation

```bash
npm install maplibre-gl @protomaps/basemaps
npm install --save-dev @types/maplibre-gl
```

## Configuration

```typescript
// src/atlas.config.ts
export const ATLAS_URL = process.env.REACT_APP_ATLAS_URL ?? 'https://api.atlas-maps.dev';
export const ATLAS_API_KEY = process.env.REACT_APP_ATLAS_API_KEY ?? '';

export function atlasHeaders(): HeadersInit {
  return ATLAS_API_KEY ? { 'X-API-Key': ATLAS_API_KEY } : {};
}
```

## Map component

```tsx
// src/components/AtlasMap.tsx
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { layersWithConfig } from '@protomaps/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ATLAS_URL } from '../atlas.config';

interface AtlasMapProps {
  center?: [number, number];
  zoom?: number;
  tileset?: string;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function AtlasMap({ center = [-0.187, 5.603], zoom = 12, tileset = 'ghana', onMapReady }: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
        sources: {
          atlas: {
            type: 'vector',
            url: `${ATLAS_URL}/v1/tiles/${tileset}/tilejson.json`
          }
        },
        layers: layersWithConfig({ theme: 'light', dataSource: 'atlas' })
      },
      center,
      zoom
    });

    mapRef.current = map;
    map.on('load', () => onMapReady?.(map));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

## Geocoding hook

```tsx
// src/hooks/useGeocode.ts
import { useState, useEffect } from 'react';
import { ATLAS_URL, atlasHeaders } from '../atlas.config';

interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  confidence: number;
}

export function useGeocode(query: string, options?: { limit?: number; country?: string }) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.country) params.set('country', options.country);

    setLoading(true);
    setError(null);

    fetch(`${ATLAS_URL}/v1/geocode?${params}`, {
      headers: atlasHeaders(),
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
        return res.json();
      })
      .then(data => setResults(data.results ?? []))
      .catch(err => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query, options?.limit, options?.country]);

  return { results, loading, error };
}
```

## Routing hook

```tsx
// src/hooks/useRoute.ts
import { useState, useEffect } from 'react';
import { ATLAS_URL, atlasHeaders } from '../atlas.config';

interface LatLon { lat: number; lon: number; }

interface RouteInstruction {
  type: string;
  road: string | null;
  distance_m: number;
  bearing: number;
}

interface RouteResult {
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
  instructions: RouteInstruction[];
}

export function useRoute(
  origin: LatLon | null,
  destination: LatLon | null,
  profile: 'car' | 'motorcycle' | 'bicycle' | 'foot' = 'car'
) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${ATLAS_URL}/v1/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...atlasHeaders() },
      body: JSON.stringify({ origin, destination, profile }),
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error(`Route failed: ${res.status}`);
        return res.json();
      })
      .then(setRoute)
      .catch(err => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [origin?.lat, origin?.lon, destination?.lat, destination?.lon, profile]);

  return { route, loading, error };
}
```

## Place search hook

```tsx
// src/hooks/useSearch.ts
import { useState, useEffect } from 'react';
import { ATLAS_URL, atlasHeaders } from '../atlas.config';

interface SearchResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  distance_m: number | null;
  score: number;
}

export function useSearch(params: {
  q?: string;
  lat?: number;
  lon?: number;
  category?: string;
  radius_km?: number;
  limit?: number;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!params.q && !params.category) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.lat != null) qs.set('lat', String(params.lat));
    if (params.lon != null) qs.set('lon', String(params.lon));
    if (params.category) qs.set('category', params.category);
    if (params.radius_km) qs.set('radius_km', String(params.radius_km));
    if (params.limit) qs.set('limit', String(params.limit));

    setLoading(true);
    setError(null);

    fetch(`${ATLAS_URL}/v1/search?${qs}`, {
      headers: atlasHeaders(),
      signal: controller.signal
    })
      .then(res => {
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        return res.json();
      })
      .then(data => setResults(data.results ?? []))
      .catch(err => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [params.q, params.lat, params.lon, params.category, params.radius_km, params.limit]);

  return { results, loading, error };
}
```

## Complete example — delivery app map

```tsx
// src/App.tsx
import { useState, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { AtlasMap } from './components/AtlasMap';
import { useGeocode } from './hooks/useGeocode';
import { useRoute } from './hooks/useRoute';

interface LatLon { lat: number; lon: number; }

export function DeliveryApp() {
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<LatLon | null>({ lat: 5.603, lon: -0.187 });
  const [destination, setDestination] = useState<LatLon | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const { results: geocodeResults } = useGeocode(query, { limit: 5 });
  const { route, loading: routeLoading } = useRoute(origin, destination, 'motorcycle');

  function selectDestination(result: { lat: number; lon: number; name: string }) {
    setDestination({ lat: result.lat, lon: result.lon });
    setQuery('');

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [result.lon, result.lat], zoom: 14 });
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 320, padding: 16, background: '#fff', boxShadow: '2px 0 8px rgba(0,0,0,0.1)' }}>
        <h2>Delivery Route</h2>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search delivery address..."
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />

        {geocodeResults.map((result, i) => (
          <div
            key={i}
            onClick={() => selectDestination(result)}
            style={{ padding: 8, cursor: 'pointer', borderBottom: '1px solid #eee' }}
          >
            <strong>{result.name}</strong>
            <div style={{ fontSize: 12, color: '#666' }}>{result.address}</div>
          </div>
        ))}

        {route && (
          <div style={{ marginTop: 16, padding: 12, background: '#f0f8ff', borderRadius: 8 }}>
            <strong>{(route.distance_m / 1000).toFixed(1)} km</strong>
            {' · '}
            <span>{Math.round(route.duration_s / 60)} min</span>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              {route.instructions.length} turns
            </div>
          </div>
        )}

        {routeLoading && <div>Calculating route...</div>}
      </div>

      <div style={{ flex: 1 }}>
        <AtlasMap onMapReady={map => { mapRef.current = map; }} />
      </div>
    </div>
  );
}
```
