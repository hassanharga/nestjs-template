# Backend capabilities

## Core and examples

Configuration, logging, errors, DTO validation, health probes, rate limiting,
and shared HTTP setup form the core. Business code belongs in
src/features/<feature>. The removable example demonstrates transport behavior.
Register business modules in src/features/api.modules.ts for both runtime and
OpenAPI export. Remove ExampleModule there when replacing the example, then
regenerate the contract and sync consuming clients. See [API generation](api-generation.md).
When adding a domain layer, keep DTOs and HTTP exceptions at the boundary.

@Log() records method names, outcomes, and duration by default. Arguments and
results require opt-in. Structured secret keys are redacted, values bounded,
and getters skipped. Free-text secrets cannot be reliably recognized: do not
opt payloads containing secrets into logging.

## Monitoring

Set FEATURE_MONITORING=true for MonitoringModule, /metrics, process metrics,
and HTTP counter/histogram middleware. Responses are recorded once on finish or
disconnect using route patterns. Unknown routes share unmatched; disconnected
requests use synthetic status 499.

For local infrastructure, set GRAFANA_ADMIN_PASSWORD in .env and run
`pnpm docker:monitoring:up`. The additional Compose file enables application
metrics and adds one optional Grafana LGTM development container for metrics,
logs and traces. Ports bind to loopback; no Docker socket is mounted. Choose
production monitoring and access policies in the consuming project.

Physical removal: remove the conditional monitoring imports from AppModule and
ResilienceModule, src/common/monitoring and its tests/settings, and the Compose
overlay. Resilience runs without the metrics module or infrastructure. Its
optional observer still uses metric injection/types from nestjs-prometheus and
prom-client; keep those packages while retaining that observer, or replace the
optional metric adapter before removing them. Remove only unused dependencies
through the package manager.

## Resilience

FEATURE_RESILIENCE=true registers ResilienceModule at the root. Feature modules
injecting ResilienceRegistry must also import ResilienceModule; it is not global.
Create and retain one policy per upstream operation, so circuit-breaker and
concurrency state survive across requests:

```typescript
const policy = registry.create({
  name: 'catalog-read',
  retry: true,
  timeout: { ms: 1000 },
  totalTimeout: { ms: 4000 },
  circuitBreaker: true,
  bulkhead: true,
});
await policy.execute(
  ({ signal }) => fetch(catalogUrl, { signal }),
  callerSignal,
);
```

fetch does not throw on non-2xx responses. Classify failed responses and throw
an appropriate status-bearing error when retry is intended. Classification
covers selected transient transport failures and HTTP 408/429/502/503/504.
Returned neverthrow err() values are not rejected promises and are not retried.

RESILIENCE_RETRY_MAX_ATTEMPTS and retry.maxAttempts count additional retries:
3 allows up to four executions. Known transient codes are recognized through a
bounded, cycle-safe cause chain (including Node fetch failures); explicit aborts
and permanent outer HTTP statuses are not reclassified by their cause.

Per-attempt timeout is inside retry; totalTimeout bounds queueing, backoff, and
attempts. Pass the policy signal to I/O; timeouts cannot undo side effects.
Timeout metrics/logs distinguish kind=attempt from kind=total. Caller aborts
and an outer total-budget abort do not count as inner attempt timeouts.
Retry only operations safe to repeat or use application-specific idempotency
keys. Implement upstream Retry-After requirements in the integration policy.

@Resilience() uses fallback defaults with policy state per service instance and
appends policy context to method arguments. Prefer the injected registry for
configured defaults, explicit cancellation, and observability.

Physical removal: remove conditional/root and feature imports, decorator usages,
src/common/resilience, its tests/settings, and the unused Cockatiel dependency.
Remove the monitoring integration adapter resilience.metrics.ts and its test, and
remove resilienceMetricProviders imports/exports/providers from MonitoringModule.
Its remaining HTTP and process metrics are independent.

## Project-specific additions

Authentication, authorization, database repositories/migrations, cache, queues,
tracing, and idempotency belong to consuming-project requirements. Each addition
should own its config, health implications, tests, and removal instructions.
Avoid empty placeholder modules.

## Shutdown and readiness propagation

SHUTDOWN_DRAIN_DELAY_MS defaults to 0 for immediate local shutdown. Set it to
your load balancer/probe propagation window in deployments (for example 10000),
and increase SHUTDOWN_TIMEOUT above it (for example 30000). The hard deadline
includes the drain delay and application close. Set the orchestrator/container
grace period above that deadline. Readiness returns 503 during the delay while
the listener remains open; existing traffic can complete. Do not combine an
application dwell with an unnecessary second preStop sleep.

Configure load balancers/Kubernetes readiness checks against /health/ready;
/health/live remains a process check. The starter Compose healthcheck uses
liveness and does not implement load-balancer deregistration. The right dwell
is deployment-specific; the template does not claim zero dropped requests in
an untested deployment.

See [observability](observability.md) for optional tracing, linked log export and the local Grafana setup.
