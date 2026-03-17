---
sidebar_position: 4
---

# React Native

Build delivery and logistics apps with Atlas on iOS and Android. This guide covers map rendering, geocoding, routing, and GPS trip telemetry collection — the core features for delivery tracking apps.

## Installation

```bash
npm install @maplibre/maplibre-react-native expo-location
npx pod-install  # iOS only
```

If not using Expo:

```bash
npm install @maplibre/maplibre-react-native
cd ios && pod install
```

## Configuration

```typescript
// src/atlas.ts
export const ATLAS_URL = process.env.EXPO_PUBLIC_ATLAS_URL ?? 'https://api.atlas-maps.dev';
export const ATLAS_API_KEY = process.env.EXPO_PUBLIC_ATLAS_API_KEY ?? '';

export function atlasHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ATLAS_API_KEY) headers['X-API-Key'] = ATLAS_API_KEY;
  return headers;
}
```

## Map component

```tsx
// src/components/DeliveryMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import { ATLAS_URL } from '../atlas';

MapLibreGL.setAccessToken(null);

interface DeliveryMapProps {
  center?: [number, number];
  zoom?: number;
  tileset?: string;
  routeGeoJSON?: GeoJSON.Feature | null;
  onPress?: (coords: { latitude: number; longitude: number }) => void;
}

export function DeliveryMap({
  center = [-0.187, 5.603],
  zoom = 12,
  tileset = 'ghana',
  routeGeoJSON = null,
  onPress
}: DeliveryMapProps) {
  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={`${ATLAS_URL}/v1/tiles/${tileset}/tilejson.json`}
        onPress={feature => {
          const coords = feature.geometry as GeoJSON.Point;
          onPress?.({ latitude: coords.coordinates[1], longitude: coords.coordinates[0] });
        }}
      >
        <MapLibreGL.Camera
          centerCoordinate={center}
          zoomLevel={zoom}
          animationDuration={500}
        />

        {routeGeoJSON && (
          <MapLibreGL.ShapeSource id="route" shape={routeGeoJSON}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: '#0066cc', lineWidth: 4, lineJoin: 'round', lineCap: 'round' }}
            />
          </MapLibreGL.ShapeSource>
        )}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 }
});
```

## Geocoding

```tsx
// src/hooks/useGeocode.ts
import { useState, useEffect } from 'react';
import { ATLAS_URL, atlasHeaders } from '../atlas';

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
  category: string;
  address: string | null;
  confidence: number;
}

export function useGeocode(query: string) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`${ATLAS_URL}/v1/geocode?q=${encodeURIComponent(query)}&limit=5`, {
      headers: atlasHeaders(),
      signal: controller.signal
    })
      .then(r => r.json())
      .then(data => setResults(data.results ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [query]);

  return { results, loading };
}
```

## Routing

```typescript
// src/api/route.ts
import { ATLAS_URL, atlasHeaders } from '../atlas';

export interface LatLon { lat: number; lon: number; }

export interface RouteResult {
  distance_m: number;
  duration_s: number;
  geometry: GeoJSON.LineString;
  instructions: Array<{ type: string; road: string | null; distance_m: number; bearing: number }>;
}

export async function getRoute(
  origin: LatLon,
  destination: LatLon,
  profile: 'car' | 'motorcycle' | 'bicycle' | 'foot' = 'motorcycle'
): Promise<RouteResult> {
  const response = await fetch(`${ATLAS_URL}/v1/route`, {
    method: 'POST',
    headers: atlasHeaders(),
    body: JSON.stringify({ origin, destination, profile })
  });

  if (!response.ok) throw new Error(`Route request failed: ${response.status}`);
  return response.json();
}
```

## GPS trip telemetry

The telemetry API collects GPS traces from opted-in users to improve ETA accuracy. Always get explicit user consent before starting telemetry collection.

```tsx
// src/hooks/useTripTelemetry.ts
import { useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { ATLAS_URL, atlasHeaders } from '../atlas';

interface TelemetryWaypoint {
  lat: number;
  lon: number;
  timestamp: string;
  speed_kmh?: number;
  bearing?: number;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;

export function useTripTelemetry() {
  const tripIdRef = useRef<string | null>(null);
  const waypointBufferRef = useRef<TelemetryWaypoint[]>([]);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flushWaypoints = useCallback(async () => {
    const tripId = tripIdRef.current;
    if (!tripId || waypointBufferRef.current.length === 0) return;

    const batch = waypointBufferRef.current.splice(0, BATCH_SIZE);
    await fetch(`${ATLAS_URL}/v1/telemetry/${tripId}/update`, {
      method: 'POST',
      headers: atlasHeaders(),
      body: JSON.stringify({ waypoints: batch })
    });
  }, []);

  const startTrip = useCallback(async (
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    profile: 'car' | 'motorcycle' | 'bicycle' | 'foot' = 'motorcycle'
  ) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission denied');

    const response = await fetch(`${ATLAS_URL}/v1/telemetry/start`, {
      method: 'POST',
      headers: atlasHeaders(),
      body: JSON.stringify({ profile, origin, destination })
    });

    if (!response.ok) throw new Error('Failed to start trip telemetry');
    const { trip_id } = await response.json();
    tripIdRef.current = trip_id;

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 50,
        timeInterval: 10_000
      },
      location => {
        waypointBufferRef.current.push({
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          timestamp: new Date(location.timestamp).toISOString(),
          speed_kmh: location.coords.speed != null ? location.coords.speed * 3.6 : undefined,
          bearing: location.coords.heading ?? undefined
        });

        if (waypointBufferRef.current.length >= BATCH_SIZE) {
          flushWaypoints();
        }
      }
    );

    flushIntervalRef.current = setInterval(flushWaypoints, FLUSH_INTERVAL_MS);
    return trip_id as string;
  }, [flushWaypoints]);

  const endTrip = useCallback(async () => {
    const tripId = tripIdRef.current;
    if (!tripId) return null;

    locationSubRef.current?.remove();
    locationSubRef.current = null;

    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }

    await flushWaypoints();
    tripIdRef.current = null;
    waypointBufferRef.current = [];

    const response = await fetch(`${ATLAS_URL}/v1/telemetry/${tripId}/end`, {
      method: 'POST',
      headers: atlasHeaders()
    });

    if (!response.ok) return null;
    return response.json() as Promise<{ status: string; duration_s: number; distance_m: number }>;
  }, [flushWaypoints]);

  return { startTrip, endTrip };
}
```

## Complete delivery driver app

```tsx
// src/screens/DeliveryScreen.tsx
import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { DeliveryMap } from '../components/DeliveryMap';
import { useTripTelemetry } from '../hooks/useTripTelemetry';
import { getRoute, type RouteResult } from '../api/route';
import { ATLAS_URL } from '../atlas';

const DEPOT = { lat: 5.603, lon: -0.187 };
const DELIVERY_ADDRESS = { lat: 5.614, lon: -0.220 };

export function DeliveryScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [tripActive, setTripActive] = useState(false);
  const [tripSummary, setTripSummary] = useState<{ duration_s: number; distance_m: number } | null>(null);
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const { startTrip, endTrip } = useTripTelemetry();

  async function handleStartDelivery() {
    Alert.alert(
      'Share location data?',
      'Atlas can learn from your route to improve ETAs for everyone. Your data is anonymized.',
      [
        { text: 'No thanks', style: 'cancel' },
        {
          text: 'Yes, share',
          onPress: async () => {
            try {
              const [fetchedRoute] = await Promise.all([
                getRoute(DEPOT, DELIVERY_ADDRESS, 'motorcycle'),
                startTrip(DEPOT, DELIVERY_ADDRESS, 'motorcycle')
              ]);
              setRoute(fetchedRoute);
              setTripActive(true);

              cameraRef.current?.fitBounds(
                [DEPOT.lon, DEPOT.lat],
                [DELIVERY_ADDRESS.lon, DELIVERY_ADDRESS.lat],
                50
              );
            } catch (err) {
              Alert.alert('Error', 'Could not start navigation');
            }
          }
        }
      ]
    );
  }

  async function handleEndDelivery() {
    const summary = await endTrip();
    setTripActive(false);
    setRoute(null);
    if (summary) {
      setTripSummary(summary);
    }
  }

  const routeGeoJSON: GeoJSON.Feature | null = route
    ? { type: 'Feature', properties: {}, geometry: route.geometry }
    : null;

  return (
    <View style={styles.container}>
      <DeliveryMap routeGeoJSON={routeGeoJSON} />

      <View style={styles.panel}>
        {route && (
          <Text style={styles.routeInfo}>
            {(route.distance_m / 1000).toFixed(1)} km · {Math.round(route.duration_s / 60)} min
          </Text>
        )}

        {tripSummary && (
          <Text style={styles.summaryText}>
            Trip complete: {(tripSummary.distance_m / 1000).toFixed(1)} km in {Math.round(tripSummary.duration_s / 60)} min
          </Text>
        )}

        {!tripActive ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStartDelivery}>
            <Text style={styles.buttonText}>Start Delivery</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.endButton} onPress={handleEndDelivery}>
            <Text style={styles.buttonText}>End Delivery</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  panel: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
  routeInfo: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  summaryText: { fontSize: 14, color: '#666', marginBottom: 12 },
  startButton: { backgroundColor: '#0066cc', padding: 14, borderRadius: 8, alignItems: 'center' },
  endButton: { backgroundColor: '#cc0000', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 }
});
```

## Background location (production)

For production delivery apps that need location tracking when the app is backgrounded:

```bash
npx expo install expo-task-manager expo-background-fetch
```

```typescript
// src/backgroundTracking.ts
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const BACKGROUND_LOCATION_TASK = 'ATLAS_BACKGROUND_LOCATION';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  // Send to telemetry — store in AsyncStorage if offline, flush on reconnect
});

export async function startBackgroundTracking() {
  await Location.requestBackgroundPermissionsAsync();
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 100,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Delivery in progress',
      notificationBody: 'Location is being used for navigation'
    }
  });
}

export async function stopBackgroundTracking() {
  await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
```
