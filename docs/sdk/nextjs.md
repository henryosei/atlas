---
sidebar_position: 3
---

# Next.js

Next.js integration with Atlas requires handling MapLibre's browser-only APIs and optionally proxying API requests through Next.js API routes to keep your API key server-side.

## Installation

```bash
npm install maplibre-gl @protomaps/basemaps
npm install --save-dev @types/maplibre-gl
```

## Environment variables

```bash
# .env.local
ATLAS_URL=https://api.atlas-maps.dev
ATLAS_API_KEY=your-api-key

# Exposed to the browser — only use if not proxying
NEXT_PUBLIC_ATLAS_URL=https://api.atlas-maps.dev
```

## Dynamic import (required for SSR)

MapLibre uses browser-only APIs (`window`, `navigator`). Import it dynamically to avoid SSR errors.

```tsx
// components/AtlasMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import type maplibreglType from 'maplibre-gl';
import type { Map } from 'maplibre-gl';

interface AtlasMapProps {
  center?: [number, number];
  zoom?: number;
  tileset?: string;
  onMapReady?: (map: Map) => void;
}

export function AtlasMap({ center = [-0.187, 5.603], zoom = 12, tileset = 'ghana', onMapReady }: AtlasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: Map;

    Promise.all([
      import('maplibre-gl'),
      import('@protomaps/basemaps'),
      import('maplibre-gl/dist/maplibre-gl.css' as string)
    ]).then(([maplibregl, { layersWithConfig }]) => {
      const ATLAS_URL = process.env.NEXT_PUBLIC_ATLAS_URL ?? '/api/atlas';

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: {
          version: 8,
          glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
          sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
          sources: {
            atlas: {
              type: 'vector',
              url: `${ATLAS_URL}/tiles/${tileset}/tilejson.json`
            }
          },
          layers: layersWithConfig({ theme: 'light', dataSource: 'atlas' })
        },
        center,
        zoom
      });

      mapRef.current = map;
      map.on('load', () => onMapReady?.(map));
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

Use `next/dynamic` to load the map component client-side only:

```tsx
// app/page.tsx or pages/index.tsx
import dynamic from 'next/dynamic';

const AtlasMap = dynamic(
  () => import('../components/AtlasMap').then(m => m.AtlasMap),
  {
    ssr: false,
    loading: () => <div style={{ width: '100%', height: '100vh', background: '#f0ebe3' }}>Loading map...</div>
  }
);

export default function Page() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <AtlasMap center={[-0.187, 5.603]} zoom={12} />
    </div>
  );
}
```

## API route proxy (recommended)

Proxy Atlas API calls through a Next.js API route to keep your API key out of the browser.

```typescript
// app/api/atlas/[...path]/route.ts (App Router)
import { NextRequest, NextResponse } from 'next/server';

const ATLAS_URL = process.env.ATLAS_URL ?? 'https://api.atlas-maps.dev';
const ATLAS_API_KEY = process.env.ATLAS_API_KEY ?? '';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const search = req.nextUrl.search;
  const url = `${ATLAS_URL}/v1/${path}${search}`;

  const response = await fetch(url, {
    headers: { 'X-API-Key': ATLAS_API_KEY }
  });

  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': response.headers.get('Cache-Control') ?? 'no-cache'
    }
  });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const url = `${ATLAS_URL}/v1/${path}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ATLAS_API_KEY
    },
    body: await req.text()
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

With this proxy in place, client-side code calls `/api/atlas/...` instead of `https://api.atlas-maps.dev/v1/...`:

```typescript
// Client-side (no API key needed)
const ATLAS_URL = '/api/atlas';

const results = await fetch(`${ATLAS_URL}/geocode?q=Accra+Mall`).then(r => r.json());
```

## Geocoding with server actions (App Router)

For forms and server components, use server actions:

```typescript
// app/actions/geocode.ts
'use server';

const ATLAS_URL = process.env.ATLAS_URL ?? 'https://api.atlas-maps.dev';
const ATLAS_API_KEY = process.env.ATLAS_API_KEY ?? '';

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  confidence: number;
}

export async function geocodeAction(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({ q: query, limit: '5' });
  const response = await fetch(`${ATLAS_URL}/v1/geocode?${params}`, {
    headers: { 'X-API-Key': ATLAS_API_KEY },
    next: { revalidate: 3600 }
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.results ?? [];
}
```

```tsx
// app/components/AddressSearch.tsx
'use client';

import { useState } from 'react';
import { geocodeAction, type GeocodeResult } from '../actions/geocode';

export function AddressSearch({ onSelect }: { onSelect: (result: GeocodeResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length > 2) {
      const found = await geocodeAction(value);
      setResults(found);
    } else {
      setResults([]);
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={e => handleSearch(e.target.value)}
        placeholder="Enter address..."
      />
      {results.map((result, i) => (
        <div key={i} onClick={() => { onSelect(result); setResults([]); }}>
          {result.name} — {result.address}
        </div>
      ))}
    </div>
  );
}
```

## Pages Router equivalent

```typescript
// pages/api/atlas/[...path].ts
import type { NextApiRequest, NextApiResponse } from 'next';

const ATLAS_URL = process.env.ATLAS_URL ?? 'https://api.atlas-maps.dev';
const ATLAS_API_KEY = process.env.ATLAS_API_KEY ?? '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = (req.query.path as string[]).join('/');
  const search = new URLSearchParams(
    Object.entries(req.query)
      .filter(([key]) => key !== 'path')
      .flatMap(([k, v]) => Array.isArray(v) ? v.map(val => [k, val]) : [[k, v as string]])
  ).toString();

  const url = `${ATLAS_URL}/v1/${path}${search ? `?${search}` : ''}`;

  const response = await fetch(url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ATLAS_API_KEY
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
```
