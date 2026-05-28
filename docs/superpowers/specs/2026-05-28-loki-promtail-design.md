# Loki + Promtail Log Aggregation

**Date:** 2026-05-28
**Status:** Approved

## Context

The docker-compose stack already runs the NestJS API (Pino structured JSON logging), Prometheus, and Grafana. Logs are currently only visible via `docker compose logs`. The goal is to ship all container logs into Grafana through Loki so developers can query, filter, and correlate logs alongside metrics in one place.

## Architecture

```
[API / Prometheus / Grafana containers]
         │  (stdout/stderr via Docker)
         ▼
     Promtail
  (docker_sd_configs)
  /var/run/docker.sock
         │  (HTTP push)
         ▼
       Loki :3100
  (filesystem storage)
         │  (HTTP query)
         ▼
      Grafana
  (Loki datasource)
```

Promtail uses Docker service discovery (`docker_sd_configs`) — it connects to the Docker socket, auto-discovers all running containers, and tails their logs without needing to mount host filesystem paths. This works on macOS (Docker Desktop / OrbStack) where container log files are inside the Docker VM and not directly accessible from the host.

## Files to Add or Modify

### `docker-compose.yml` — add two services

```yaml
loki:
  image: grafana/loki:3.4.2
  ports:
    - "3100:3100"
  volumes:
    - ./docker/loki/loki.yml:/etc/loki/local-config.yaml:ro
    - loki-data:/tmp/loki
  networks:
    - app-network
  restart: unless-stopped

promtail:
  image: grafana/promtail:3.4.2
  volumes:
    - ./docker/promtail/promtail.yml:/etc/promtail/config.yml:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - app-network
  depends_on:
    - loki
  restart: unless-stopped
```

Also add `loki-data` to the top-level `volumes:` block.

### `docker/loki/loki.yml` — minimal single-node config

- Auth disabled
- Filesystem storage under `/tmp/loki` (matches the named volume mount)
- Schema v13 with TSDB store
- Embedded results cache (100 MB)
- No object store, no clustering

### `docker/promtail/promtail.yml` — Docker service discovery

- `docker_sd_configs` pointing at `unix:///var/run/docker.sock`
- Refresh interval: 5s
- Relabel rules extract:
  - `container` — from `__meta_docker_container_name` (strips leading `/`)
  - `service` — from `__meta_docker_compose_service`
- Push target: `http://loki:3100/loki/api/v1/push`

### `docker/grafana/provisioning/datasources/loki.yml` — new datasource file

```yaml
apiVersion: 1
datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    isDefault: false
    editable: false
```

## What Does Not Change

- NestJS app code — Pino logs to stdout, Docker captures it, Promtail ships it
- Prometheus scrape config
- Grafana metrics dashboard
- `docker/grafana/provisioning/datasources/prometheus.yml`

## Verification

```bash
docker compose up --build

# Loki ready
curl http://localhost:3100/ready   # → "ready"

# Promtail targets (should show all containers)
curl http://localhost:9080/targets

# In Grafana (localhost:3001)
# Explore → datasource: Loki
# Label filter: service = api
# Should show Pino JSON log lines
```
