---
sidebar_position: 6
---

# Contributions

The contributions API allows users to report map errors, road problems, and incorrect routing. Reports feed back into routing as edge penalties, and can be reviewed by maintainers for permanent OSM fixes.

## Report an issue

```
POST /v1/contribute
```

### Request body

```json
{
  "route_origin": { "lat": 5.603, "lon": -0.187 },
  "route_destination": { "lat": 5.614, "lon": -0.220 },
  "profile": "car",
  "issue_type": "road_closed",
  "description": "Road flooded after rain, impassable for at least a week"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `route_origin` | LatLon | yes | Start of the problematic route segment |
| `route_destination` | LatLon | yes | End of the problematic route segment |
| `profile` | string | yes | Routing profile that experienced the issue |
| `issue_type` | string | yes | Issue category (see below) |
| `description` | string | no | Additional details |

### Issue types

| Type | Description |
|------|-------------|
| `road_closed` | Road is completely impassable |
| `road_flooded` | Road flooded, temporary closure |
| `wrong_direction` | One-way direction is incorrect |
| `wrong_turn` | Turn restriction is wrong |
| `speed_too_high` | Road slower than Atlas estimates |
| `missing_road` | Road exists but is not in the map |
| `bad_surface` | Road surface much worse than mapped |
| `roundabout_wrong` | Wrong roundabout exit count |

### Response

```json
{
  "id": "contrib_01HX3K9P7Q2M4R6S8T0V"
}
```

### Effect on routing

Submitted issues are immediately applied as temporary edge penalties on the affected route segment. This means:

- A `road_closed` report adds a very high penalty (effectively blocks the road)
- A `speed_too_high` report adds a moderate time penalty
- Reports from multiple users on the same segment increase the penalty

Penalties decay over time (7 days for most types, 30 days for `road_closed`) unless additional reports confirm the issue.

### Example

```bash
curl -X POST https://api.atlas-maps.dev/v1/contribute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "route_origin": { "lat": 5.603, "lon": -0.187 },
    "route_destination": { "lat": 5.614, "lon": -0.220 },
    "profile": "car",
    "issue_type": "road_flooded",
    "description": "Flooding near Tema Station after heavy rain"
  }'
```
