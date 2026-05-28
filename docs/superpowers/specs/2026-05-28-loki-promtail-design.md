# Loki + Grafana Alloy Log Aggregation

**Date:** 2026-05-28
**Status:** Approved (updated: replaced Promtail with Grafana Alloy — Promtail is EOL as of March 2026)

## Context

The docker-compose stack already runs the NestJS API (Pino structured JSON logging), Prometheus, and Grafana. Logs are currently only visible via `docker compose logs`. The goal is to ship all container logs into Grafana through Loki so developers can query, filter, and correlate logs alongside metrics in one place.

Promtail is end-of-life as of March 2, 2026. The official Grafana replacement is **Grafana Alloy**, which ships logs to Loki via the `loki.source.docker` + `discovery.docker` component pipeline.

## Architecture

```
[API / Prometheus / Grafana containers]
         │  (stdout/stderr via Docker)
         ▼
    Grafana Alloy
  (loki.source.docker
   + discovery.docker)
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

Alloy uses `discovery.docker` to auto-discover containers via the Docker socket and `loki.source.docker` to tail their logs. No host filesystem path mounts needed — works on macOS (Docker Desktop / OrbStack) where container log files are inside the Docker VM.

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

alloy:
  image: grafana/alloy:v1.16.1
  volumes:
    - ./docker/alloy/config.alloy:/etc/alloy/config.alloy:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  command:
    - run
    - --storage.path=/var/lib/alloy/data
    - /etc/alloy/config.alloy
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

### `docker/alloy/config.alloy` — Alloy River config

`discovery.docker` finds all containers via the socket. `discovery.relabel` maps Docker metadata to Loki labels (`container`, `compose_service`). `loki.source.docker` tails the logs and forwards them.

```alloy
discovery.docker "containers" {
  host = "unix:///var/run/docker.sock"
}

discovery.relabel "containers" {
  targets = discovery.docker.containers.targets

  rule {
    source_labels = ["__meta_docker_container_name"]
    regex         = "/(.*)"
    target_label  = "container"
  }

  rule {
    source_labels = ["__meta_docker_compose_service"]
    target_label  = "compose_service"
  }
}

loki.source.docker "default" {
  host       = "unix:///var/run/docker.sock"
  targets    = discovery.relabel.containers.output
  forward_to = [loki.write.local.receiver]
}

loki.write "local" {
  endpoint {
    url = "http://loki:3100/loki/api/v1/push"
  }
}
```

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

- NestJS app code — Pino logs to stdout, Docker captures it, Alloy ships it
- Prometheus scrape config
- Grafana metrics dashboard
- `docker/grafana/provisioning/datasources/prometheus.yml`

## Verification

```bash
docker compose up --build

# Loki ready
curl http://localhost:3100/ready   # → "ready"

# In Grafana (localhost:3001)
# Explore → datasource: Loki
# Label filter: container = be-api-1
# Should show Pino JSON log lines from all containers
```
