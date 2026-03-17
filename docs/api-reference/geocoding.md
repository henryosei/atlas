---
sidebar_position: 3
---

# Geocoding

Atlas provides forward geocoding (address/place name → coordinates) and reverse geocoding (coordinates → address/place name), with support for African languages and landmark-relative addressing.

## Forward geocoding

```
GET /v1/geocode
```

Convert a query string to geographic coordinates. Supports English, French, Arabic, Swahili, Twi, and Yoruba place names. Understands landmark-relative queries like "near the MTN mast, Kumasi".

### Query parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | yes | — | Search query |
| `limit` | integer | no | 5 | Max results (1–20) |
| `country` | string | no | — | ISO 3166-1 alpha-2 country code to bias results (e.g., `GH`, `NG`, `KE`) |
| `lat` | number | no | — | Latitude to bias results toward |
| `lon` | number | no | — | Longitude to bias results toward |

### Response

```json
{
  "results": [
    {
      "name": "Makola Market",
      "lat": 5.5492,
      "lon": -0.2138,
      "category": "marketplace",
      "address": "Makola, Accra Central, Greater Accra",
      "confidence": 0.97
    },
    {
      "name": "Makola Market Bus Stop",
      "lat": 5.5488,
      "lon": -0.2141,
      "category": "bus_stop",
      "address": "Makola, Accra Central, Greater Accra",
      "confidence": 0.72
    }
  ]
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Place name |
| `lat` | number | Latitude |
| `lon` | number | Longitude |
| `category` | string | Place category (see [categories](#place-categories)) |
| `address` | string \| null | Human-readable address or null if unavailable |
| `confidence` | number | Match score 0.0–1.0; higher is better |

### Examples

```bash
# Basic search
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/geocode?q=Makola+Market"

# With result limit and country bias
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/geocode?q=Lagos+Island&limit=3&country=NG"

# Location-biased (near Accra)
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/geocode?q=Shoprite&lat=5.603&lon=-0.187"
```

## Reverse geocoding

```
GET /v1/reverse
```

Convert coordinates to the nearest named place or address.

### Query parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lat` | number | yes | — | Latitude |
| `lon` | number | yes | — | Longitude |
| `limit` | integer | no | 1 | Max results (1–10) |

### Response

```json
{
  "results": [
    {
      "name": "Osu Castle",
      "lat": 5.5493,
      "lon": -0.1769,
      "distance_m": 47.3,
      "category": "historic"
    }
  ]
}
```

### Response fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Place name |
| `lat` | number | Place latitude |
| `lon` | number | Place longitude |
| `distance_m` | number | Distance in meters from the query point |
| `category` | string | Place category |

### Examples

```bash
# Single nearest place
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/reverse?lat=5.55&lon=-0.21"

# Multiple nearest places
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/reverse?lat=5.55&lon=-0.21&limit=5"
```

## Place categories

| Category | Description |
|----------|-------------|
| `marketplace` | Markets and trading areas |
| `hospital` | Hospitals and clinics |
| `school` | Schools and universities |
| `bank` | Banks and ATMs |
| `fuel` | Petrol/filling stations |
| `restaurant` | Restaurants and eateries |
| `hotel` | Hotels and accommodation |
| `bus_stop` | Public transport stops |
| `airport` | Airports |
| `historic` | Historic landmarks |
| `government` | Government buildings |
| `place` | Towns, cities, neighborhoods |
| `road` | Streets and roads |
