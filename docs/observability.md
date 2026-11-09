# Optional traces and linked logs

Normal terminal logging works without a collector. `FEATURE_TELEMETRY` defaults
to `false`; remote export starts only when explicitly enabled with a collector
endpoint. OpenTelemetry sends controlled server spans and curated log records
using OTLP (OpenTelemetry Protocol) over HTTP. Browsers are not instrumented.

## Enable export

```dotenv
FEATURE_TELEMETRY=true
OTEL_nestjs-api_NAME=nestjs-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_TRACES_SAMPLER_ARG=1
# Optional secret supplied at runtime, never committed:
# OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20TOKEN
```

The endpoint is a collector **base** URL: exporters append `/v1/traces` and
`/v1/logs`. HTTP and HTTPS are supported; URL credentials, queries and fragments
are rejected. Use HTTPS and secret-managed headers for remote collectors.
Service names must be static identifiers. Sampling is a root-trace probability
from 0 to 1; incoming valid W3C `traceparent` sampling decisions are respected.
Log export is independent of trace sampling, so an unsampled trace ID may have
logs without a stored trace. Export errors do not fail application requests;
queues and export deadlines are bounded, and telemetry can be lost during an
outage or forced process termination.

## Local Grafana

Set `GRAFANA_ADMIN_PASSWORD` in `.env`, then run:

```sh
pnpm docker:monitoring:up
# Grafana: http://localhost:3001, username admin
pnpm docker:monitoring:down
```

This optional development overlay uses the pinned `grafana/otel-lgtm:0.40.0`
image. It combines Grafana, Loki, Tempo, Prometheus and the collector in one
container; they remain separate processes. Anonymous access is disabled and
host ports bind to loopback. Data is retained in the `telemetry-data` volume.
The initial image is large (about 0.9 GB) and startup may download plugins.
This is a development convenience, not a production deployment design.

In Grafana Explore, use Tempo for traces and Loki for logs. `service.name`
identifies the application; exported logs carry native trace/span IDs plus
`trace_id` and `span_id` in their JSON body. The bundled datasource configuration
provides log/trace navigation. The collector does not tail terminal stdout, so
application logs are exported once through the explicit bridge.

When using both templates, start **one** collector. Run the other application
on the host with its endpoint set to `http://127.0.0.1:4318`. A container uses a
reachable collector hostname on a shared network (or `host.docker.internal` on
Docker Desktop); its own localhost points to itself. Do not start both overlays
on the same host ports. Production can use any compatible collector or hosted
observability service through the same endpoint settings.

## Data and correlation boundaries

Only spans from `template.observability` are exported. Native framework spans
are excluded because their names, attributes and exception events can contain
raw URLs and private data. Exported spans contain fixed names, duration, status,
method and validated operation identifiers. Raw URLs, queries, request/response
bodies, exception messages, stacks, span links and arbitrary attributes are not
exported. Incoming propagation accepts only a valid version-00 `traceparent`;
`baggage` and `tracestate` are not forwarded by the instrumented API transport.

Logs retain the existing terminal logger. Remote logs require stable event
names and allow only curated metadata: request ID, operation, policy, code,
method, status, duration and timeout kind. Other fields are omitted. Use static
names, never identifiers or user input as event names. `x-request-id` remains a
separate human-readable correlation ID; it is not a distributed trace ID.

## Dependencies and removal

The seven exact OpenTelemetry package pins are a coordinated compatibility set.
The trace SDK 2.12 packages include compatibility shims; do not upgrade one
package independently. To remove telemetry, remove startup, logger and request
adapters, the telemetry directory, its environment schema/settings, the optional
Compose overlay and the seven dependencies. Keep the ordinary logger and request
ID support. Metrics remain independently controlled by `FEATURE_MONITORING` in
the backend.

## Backend lifecycle

Business HTTP requests create `http.server` spans. Health, metrics and Swagger
paths are excluded. Pino records include active trace IDs and retain their safe
HTTP serializers. Telemetry-enabled development logging uses JSON so the bridge
can read structured records. No Docker socket access is needed.

The local collector scrapes the existing `/metrics` endpoint and keeps the
provisioned NestJS dashboard. `FEATURE_MONITORING` and `FEATURE_TELEMETRY` are
independent outside this convenience overlay.

Graceful shutdown closes Nest first, then flushes and shuts down telemetry
within the existing hard shutdown deadline. A forced exit can drop pending
records. Background work can use `withTelemetryOperation` and should await
`flushTelemetry`/`stopTelemetry` when its lifecycle ends; use static operation
names and never record raw payloads.
