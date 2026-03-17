---
sidebar_position: 4
---

# Routing

Atlas provides point-to-point routing and distance/duration matrix calculations optimized for African road networks — including unpaved roads, seasonal closures, and motorcycle-accessible paths.

## Get a route

```
POST /v1/route
```

Compute the fastest route between two points.

### Request body

```json
{
  "origin": { "lat": 5.603, "lon": -0.187 },
  "destination": { "lat": 6.688, "lon": -1.624 },
  "profile": "car"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origin` | LatLon | yes | Start coordinates |
| `destination` | LatLon | yes | End coordinates |
| `profile` | string | no | Routing profile (default: `car`) |

### Routing profiles

| Profile | Description |
|---------|-------------|
| `car` | Standard car routing; penalizes unpaved roads |
| `motorcycle` | Motorcycle routing; can use car roads and some tracks |
| `bicycle` | Bicycle routing; avoids motorways |
| `foot` | Pedestrian routing; uses footpaths and pedestrian areas |

### Response

```json
{
  "distance_m": 247183,
  "duration_s": 10230,
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-0.187, 5.603],
      [-0.191, 5.611],
      [-0.203, 5.634],
      [-1.624, 6.688]
    ]
  },
  "instructions": [
    {
      "type": "depart",
      "road": "Ring Road East",
      "distance_m": 1200,
      "bearing": 270
    },
    {
      "type": "turn_right",
      "road": "N1 Highway",
      "distance_m": 180000,
      "bearing": 315
    },
    {
      "type": "arrive",
      "road": null,
      "distance_m": 0,
      "bearing": 0
    }
  ]
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `distance_m` | number | Total distance in meters |
| `duration_s` | number | Estimated duration in seconds |
| `geometry` | GeoJSON LineString | Route geometry |
| `instructions` | Instruction[] | Turn-by-turn directions |

### Instruction types

| Type | Description |
|------|-------------|
| `depart` | Start of route |
| `arrive` | End of route |
| `turn_left` | Turn left |
| `turn_right` | Turn right |
| `turn_slight_left` | Slight left |
| `turn_slight_right` | Slight right |
| `turn_sharp_left` | Sharp left |
| `turn_sharp_right` | Sharp right |
| `continue` | Continue straight |
| `roundabout` | Enter roundabout, take nth exit |
| `u_turn` | U-turn |

### Example

```bash
curl -X POST https://api.atlas-maps.dev/v1/route \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "origin": { "lat": 5.603, "lon": -0.187 },
    "destination": { "lat": 6.688, "lon": -1.624 },
    "profile": "car"
  }'
```

## Distance matrix

```
POST /v1/matrix
```

Compute distances and durations between multiple origins and destinations. Useful for logistics optimization, delivery routing, and fleet management.

### Request body

```json
{
  "origins": [
    { "lat": 5.603, "lon": -0.187 },
    { "lat": 5.560, "lon": -0.205 }
  ],
  "destinations": [
    { "lat": 6.688, "lon": -1.624 },
    { "lat": 5.614, "lon": -0.220 },
    { "lat": 5.571, "lon": -0.197 }
  ],
  "profile": "motorcycle"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origins` | LatLon[] | yes | Origin coordinates (max 25) |
| `destinations` | LatLon[] | yes | Destination coordinates (max 25) |
| `profile` | string | no | Routing profile (default: `car`) |

### Response

```json
{
  "durations_s": [
    [10230, 480, 780],
    [10450, 620, 310]
  ],
  "distances_m": [
    [247183, 5200, 8100],
    [248900, 6100, 2800]
  ]
}
```

Rows correspond to origins, columns to destinations. `durations_s[i][j]` is the travel time from origin `i` to destination `j`.

### Example

```bash
curl -X POST https://api.atlas-maps.dev/v1/matrix \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "origins": [{"lat": 5.603, "lon": -0.187}],
    "destinations": [
      {"lat": 6.688, "lon": -1.624},
      {"lat": 5.614, "lon": -0.220}
    ],
    "profile": "car"
  }'
```
