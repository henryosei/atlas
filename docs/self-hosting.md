---
sidebar_position: 4
---

# Self-Hosting

Run Atlas on your own infrastructure. A single binary serves tiles, geocoding, routing, and search — no external services required except optional S3 for tile storage.

## Prerequisites

- Rust 1.75+ (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- [pmtiles CLI](https://github.com/protomaps/go-pmtiles/releases) (for downloading tile data)
- 2+ GB RAM (single country), 4+ GB RAM (regional)

## From source (recommended)

```bash
# 1. Clone and build
git clone https://github.com/Augani/atlas.git
cd atlas
cargo build --release -p atlas-server -p atlas-ingest

# 2. Download test data (Accra area + Ghana OSM PBF)
./scripts/download-test-data.sh

# 3. Build geocoding and search indices
./target/release/atlas-ingest --osm-dir ./data/osm --output-dir ./test-data
./target/release/atlas-ingest --osm-dir ./data/osm --output-dir ./test-data --build-search-index

# 4. Start the server
./target/release/atlas-server
```

The server starts at `http://localhost:3001`. Health check: `curl http://localhost:3001/health`.

## Using different regions

Atlas defaults to Ghana data. To deploy for another African country:

### 1. Download OSM data

```bash
# Kenya
curl -L -o data/osm/kenya-latest.osm.pbf \
  https://download.geofabrik.de/africa/kenya-latest.osm.pbf

# Nigeria
curl -L -o data/osm/nigeria-latest.osm.pbf \
  https://download.geofabrik.de/africa/nigeria-latest.osm.pbf

# West Africa (multi-country)
curl -L -o data/osm/west-africa-latest.osm.pbf \
  https://download.geofabrik.de/africa/west-africa-latest.osm.pbf
```

Find all available regions at [Geofabrik Africa](https://download.geofabrik.de/africa.html).

### 2. Download tiles for the region

```bash
# Kenya bounding box
pmtiles extract "https://build.protomaps.com/$(date +%Y%m%d).pmtiles" \
  test-data/kenya.pmtiles \
  --bbox="33.9,-4.7,41.9,5.5" \
  --maxzoom=15

# Nigeria
pmtiles extract "https://build.protomaps.com/$(date +%Y%m%d).pmtiles" \
  test-data/nigeria.pmtiles \
  --bbox="2.7,4.3,14.7,13.9" \
  --maxzoom=15
```

### 3. Build indices and run

```bash
cargo run --release -p atlas-ingest -- \
  --osm-dir ./data/osm \
  --output-dir ./test-data

cargo run --release -p atlas-server
```

## Configuration

All configuration is via environment variables. Copy `env.example` to `.env`:

```bash
cp env.example .env
```

### Key variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ATLAS_PORT` | `3001` | HTTP listen port |
| `ATLAS_PUBLIC_URL` | `http://localhost:3001` | Public URL (used in TileJSON URLs) |
| `ATLAS_TILE_SOURCE` | `local` | `local` or `s3` |
| `ATLAS_TILE_DIR` | `./test-data` | PMTiles directory (local mode) |
| `ATLAS_CACHE_SIZE_MB` | `256` | Tile LRU cache size |
| `ATLAS_GEOCODE_INDEX_DIR` | `./test-data/geocode-index` | Geocoding index path |
| `ATLAS_SEARCH_INDEX_DIR` | `./test-data/search-index` | Search index path |
| `ATLAS_ROUTE_DIR` | `./test-data` | Directory for routing graph files |
| `ATLAS_OSM_DIR` | `./data/osm` | OSM PBF directory for routing |
| `ATLAS_AUTH_ENABLED` | `false` | Enable API key auth |
| `ATLAS_DYNAMODB_TABLE` | `atlas_api_keys` | DynamoDB table for API keys |
| `ATLAS_DYNAMODB_REGION` | `af-south-1` | AWS region for DynamoDB |

### S3 tile storage

For production deployments, store tiles in S3 to decouple storage from compute:

```bash
ATLAS_TILE_SOURCE=s3
ATLAS_S3_BUCKET=my-atlas-tiles
ATLAS_S3_REGION=af-south-1
ATLAS_S3_TILE_KEYS=ghana-basemap.pmtiles,kenya-basemap.pmtiles
```

Atlas uses HTTP range requests against S3 presigned URLs, so individual tiles are never fully downloaded — only the requested bytes.

## Production deployment

### Reverse proxy (nginx)

```nginx
server {
    listen 80;
    server_name maps.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name maps.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/maps.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maps.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tile caching
        proxy_cache atlas_cache;
        proxy_cache_valid 200 1d;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
    }
}
```

### systemd service

```ini
# /etc/systemd/system/atlas.service
[Unit]
Description=Atlas Maps Server
After=network.target

[Service]
Type=simple
User=atlas
WorkingDirectory=/opt/atlas
ExecStart=/opt/atlas/atlas-server
Restart=always
RestartSec=5
EnvironmentFile=/opt/atlas/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable atlas
sudo systemctl start atlas
sudo journalctl -u atlas -f
```

### API key authentication

Enable DynamoDB-backed API key auth for multi-tenant deployments:

```bash
# Enable auth
ATLAS_AUTH_ENABLED=true
ATLAS_DYNAMODB_TABLE=atlas_api_keys
ATLAS_DYNAMODB_REGION=af-south-1
```

Create the DynamoDB table:
```bash
aws dynamodb create-table \
  --table-name atlas_api_keys \
  --attribute-definitions AttributeName=api_key,AttributeType=S \
  --key-schema AttributeName=api_key,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region af-south-1
```

Add an API key:
```bash
aws dynamodb put-item \
  --table-name atlas_api_keys \
  --item '{
    "api_key": {"S": "sk_live_your-key-here"},
    "name": {"S": "My App"},
    "tier": {"S": "pro"},
    "requests_per_minute": {"N": "600"}
  }' \
  --region af-south-1
```

## Hardware requirements

| Scope | RAM | Disk | CPU |
|-------|-----|------|-----|
| Single country (Ghana) | 2 GB | 10 GB | 2 cores |
| Regional (West Africa) | 4 GB | 30 GB | 4 cores |
| All of Africa | 8 GB | 50 GB | 4+ cores |

## Production checklist

- [ ] Set `ATLAS_PUBLIC_URL` to your server's public URL
- [ ] Enable TLS via nginx or Caddy
- [ ] Set `ATLAS_AUTH_ENABLED=true` and provision DynamoDB
- [ ] Set `ATLAS_CACHE_SIZE_MB` to 25% of available RAM
- [ ] Configure log rotation for the systemd service
- [ ] Set up Prometheus scraping on `/metrics`
- [ ] Test the health endpoint: `curl https://maps.yourcompany.com/health`

## Monitoring

Atlas exposes Prometheus metrics at `/metrics`:

```
atlas_requests_total{method, path, status}
atlas_request_duration_seconds{method, path, quantile}
atlas_tile_cache_hits_total
atlas_tile_cache_misses_total
atlas_active_requests
```

Useful Grafana dashboard queries:

```promql
# Request rate
rate(atlas_requests_total[5m])

# P99 latency
histogram_quantile(0.99, atlas_request_duration_seconds_bucket)

# Cache hit rate
rate(atlas_tile_cache_hits_total[5m]) /
  (rate(atlas_tile_cache_hits_total[5m]) + rate(atlas_tile_cache_misses_total[5m]))
```
