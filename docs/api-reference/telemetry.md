---
sidebar_position: 7
---

# Trip Telemetry

The telemetry API collects anonymized GPS traces from opted-in users. These traces are used to compute actual travel speeds per road segment, which improves ETA accuracy over time — especially for roads with no speed limit data in OSM.

This is the core data flywheel: more deliveries and trips → better speed estimates → more accurate ETAs → better delivery apps.

## Privacy

- Telemetry is **opt-in only** — never collect without explicit user consent
- GPS traces are anonymized before storage (user identifiers are not retained)
- Raw waypoints are aggregated into per-segment speed averages and discarded
- Users can be given the option to delete their historical traces

## Start a trip

```
POST /v1/telemetry/start
```

Call this when the user starts a trip. Returns a `trip_id` used for all subsequent telemetry updates.

### Request body

```json
{
  "profile": "motorcycle",
  "origin": { "lat": 5.603, "lon": -0.187 },
  "destination": { "lat": 6.688, "lon": -1.624 }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profile` | string | yes | Vehicle type: `car`, `motorcycle`, `bicycle`, `foot` |
| `origin` | LatLon | yes | Trip start coordinates |
| `destination` | LatLon | yes | Trip end coordinates |

### Response

```json
{
  "trip_id": "trip_01HX3K9P7Q2M4R6S8T0V"
}
```

## Send GPS waypoints

```
POST /v1/telemetry/{trip_id}/update
```

Send batches of GPS waypoints during the trip. Call this periodically (every 30–60 seconds or every 500m) rather than sending every GPS fix individually.

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `trip_id` | string | Trip ID from `/telemetry/start` |

### Request body

```json
{
  "waypoints": [
    {
      "lat": 5.6031,
      "lon": -0.1871,
      "timestamp": "2024-03-15T10:23:45Z",
      "speed_kmh": 42.5,
      "bearing": 315
    },
    {
      "lat": 5.6048,
      "lon": -0.1893,
      "timestamp": "2024-03-15T10:24:15Z",
      "speed_kmh": 38.0,
      "bearing": 310
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `waypoints` | Waypoint[] | yes | GPS waypoints (max 100 per call) |
| `waypoints[].lat` | number | yes | Latitude |
| `waypoints[].lon` | number | yes | Longitude |
| `waypoints[].timestamp` | string | yes | ISO 8601 UTC timestamp |
| `waypoints[].speed_kmh` | number | no | GPS-reported speed in km/h |
| `waypoints[].bearing` | number | no | Heading in degrees (0 = north) |

### Response

```
HTTP 200 OK
```

Empty body on success.

## End a trip

```
POST /v1/telemetry/{trip_id}/end
```

Call this when the trip is complete. Triggers server-side map-matching to correlate the GPS trace with road segments, and updates per-segment speed averages.

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `trip_id` | string | Trip ID from `/telemetry/start` |

### Response

```json
{
  "status": "processed",
  "duration_s": 3847,
  "distance_m": 58300
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `processed` or `insufficient_data` |
| `duration_s` | number | Actual trip duration in seconds |
| `distance_m` | number | Estimated trip distance in meters |

### Example — complete trip flow

```bash
# Start trip
TRIP=$(curl -s -X POST https://api.atlas-maps.dev/v1/telemetry/start \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"profile":"car","origin":{"lat":5.603,"lon":-0.187},"destination":{"lat":6.688,"lon":-1.624}}' \
  | jq -r .trip_id)

# Send waypoints periodically
curl -s -X POST "https://api.atlas-maps.dev/v1/telemetry/${TRIP}/update" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"waypoints":[{"lat":5.6031,"lon":-0.1871,"timestamp":"2024-03-15T10:23:45Z"}]}'

# End trip
curl -s -X POST "https://api.atlas-maps.dev/v1/telemetry/${TRIP}/end" \
  -H "X-API-Key: your-api-key"
```
