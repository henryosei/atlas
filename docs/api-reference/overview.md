---
sidebar_position: 1
---

# API Overview

## Base URL

| Deployment | Base URL |
|------------|----------|
| Hosted | `https://api.atlas-maps.dev` |
| Self-hosted (local dev) | `http://localhost:3001` |
| Self-hosted (custom) | Your `ATLAS_PUBLIC_URL` value |

## Authentication

All API requests require an API key passed in the `X-API-Key` header.

```bash
curl -H "X-API-Key: your-api-key" https://api.atlas-maps.dev/v1/geocode?q=Accra
```

When running self-hosted with `ATLAS_AUTH_ENABLED=false`, the header is optional.

## Rate limits

| Tier | Requests/minute | Requests/day |
|------|----------------|--------------|
| Free | 60 | 10,000 |
| Pro | 600 | 500,000 |
| Enterprise | Custom | Custom |

Rate limit headers are included in every response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1710000060
```

## Response format

All responses are JSON. Successful responses vary by endpoint (see individual endpoint docs). Error responses follow a consistent structure:

```json
{
  "error": "invalid_request",
  "message": "missing required parameter: q"
}
```

## Error codes

| HTTP Status | Error Code | Meaning |
|-------------|------------|---------|
| 400 | `invalid_request` | Missing or malformed parameters |
| 401 | `unauthorized` | Missing or invalid API key |
| 404 | `not_found` | Resource not found |
| 422 | `unprocessable` | Request is valid JSON but semantically invalid |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Server error |
| 503 | `unavailable` | Service temporarily unavailable |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/tiles/{tileset}/{z}/{x}/{y}.mvt` | Vector tile |
| GET | `/v1/tiles/{tileset}/tilejson.json` | TileJSON metadata |
| GET | `/v1/geocode` | Forward geocoding |
| GET | `/v1/reverse` | Reverse geocoding |
| GET | `/v1/search` | POI and place search |
| POST | `/v1/route` | Point-to-point route |
| POST | `/v1/matrix` | N×M distance/duration matrix |
| POST | `/v1/contribute` | Report map issue |
| POST | `/v1/telemetry/start` | Start trip telemetry |
| POST | `/v1/telemetry/{trip_id}/update` | Send GPS waypoints |
| POST | `/v1/telemetry/{trip_id}/end` | End trip |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
