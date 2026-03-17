---
sidebar_position: 5
---

# Place Search

Full-text POI and place search with optional geographic filtering and distance-based scoring.

## Search places

```
GET /v1/search
```

Search for points of interest by name, category, or both. Results are scored by text relevance and proximity when coordinates are provided.

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | no* | Text search query |
| `lat` | number | no | Latitude for proximity scoring |
| `lon` | number | no | Longitude for proximity scoring |
| `category` | string | no | Filter by category (see below) |
| `radius_km` | number | no | Search radius in km (requires `lat`/`lon`) |
| `limit` | integer | no | Max results; default 10, max 50 |

*Either `q` or `category` is required.

### Response

```json
{
  "results": [
    {
      "name": "KFC Accra Mall",
      "lat": 5.6360,
      "lon": -0.1764,
      "category": "restaurant",
      "address": "Accra Mall, Spintex Road, Accra",
      "distance_m": 1240.5,
      "score": 0.91
    },
    {
      "name": "Papaye Fast Food",
      "lat": 5.5930,
      "lon": -0.1830,
      "category": "restaurant",
      "address": "Ring Road Central, Accra",
      "distance_m": 2870.0,
      "score": 0.74
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
| `category` | string | Place category |
| `address` | string \| null | Street address if available |
| `distance_m` | number \| null | Distance from query point; null if no coordinates provided |
| `score` | number | Combined relevance + proximity score (0.0–1.0) |

### Scoring

When `lat`/`lon` are provided, the score combines:
- **Text relevance** (60%): How closely the name/category matches the query
- **Proximity** (40%): Inverse distance weighting — closer results score higher

Without coordinates, results are sorted purely by text relevance.

### Examples

```bash
# Search for restaurants near Accra city center
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/search?q=restaurant&lat=5.6&lon=-0.2&category=restaurant"

# Find all hospitals within 10 km of a point
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/search?category=hospital&lat=5.6&lon=-0.2&radius_km=10"

# Search by name
curl -H "X-API-Key: your-api-key" \
  "https://api.atlas-maps.dev/v1/search?q=Total+petrol+station&lat=5.6&lon=-0.2"
```

## Categories

| Category | Description |
|----------|-------------|
| `restaurant` | Restaurants, fast food, eateries, chop bars |
| `hospital` | Hospitals, clinics, pharmacies, health centers |
| `school` | Primary schools, secondary schools, universities |
| `bank` | Banks, ATMs, mobile money agents |
| `fuel` | Petrol stations, filling stations |
| `hotel` | Hotels, guesthouses, lodges |
| `supermarket` | Supermarkets, grocery stores |
| `marketplace` | Open markets, trading areas |
| `bus_stop` | Bus stops, trotro stations, taxi ranks |
| `airport` | Airports, airstrips |
| `church` | Churches, chapels |
| `mosque` | Mosques |
| `government` | Government offices, ministries |
| `police` | Police stations |
| `park` | Parks, gardens, green spaces |
| `historic` | Historical sites, monuments |
