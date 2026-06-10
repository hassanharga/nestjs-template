# NestJS Backend Template

A production-ready NestJS starter with structured logging, validation, health checks, Prometheus metrics, and standardized API responses.

## Stack

| Concern       | Library                     |
| ------------- | --------------------------- |
| Framework     | NestJS v11 (Express)        |
| Language      | TypeScript 5.7              |
| Validation    | nestjs-zod + Zod            |
| Logging       | nestjs-pino (JSON)          |
| Config        | @nestjs/config + Zod schema |
| API docs      | @nestjs/swagger             |
| Health        | @nestjs/terminus            |
| Metrics       | @willsoto/nestjs-prometheus |
| Rate limiting | @nestjs/throttler           |
| Resilience    | cockatiel                   |
| Security      | helmet                      |

## Getting started

```bash
pnpm install
pnpm run start:dev
```

Server starts on `http://localhost:3000`. Swagger UI is available at `http://localhost:3000/api` in non-production environments.

## Commands

```bash
pnpm run start:dev     # Development with watch mode
pnpm run build         # Compile to dist/
pnpm run start:prod    # Run compiled output

pnpm run test          # Unit tests
pnpm run test:e2e      # E2E tests
pnpm run test:cov      # Coverage report

pnpm run lint          # ESLint with auto-fix
pnpm run format        # Prettier format
```

## Environment variables

Copy `.env.example` (once created) to `.env` and override as needed. All variables have defaults.

| Variable                                        | Default       | Description                                          |
| ----------------------------------------------- | ------------- | ---------------------------------------------------- |
| `NODE_ENV`                                      | `development` | `development` \| `staging` \| `production` \| `test` |
| `PORT`                                          | `3000`        | HTTP server port                                     |
| `APP_NAME`                                      | `nestjs-app`  | Application name (used in logs)                      |
| `APP_VERSION`                                   | `1.0.0`       | Application version (shown in Swagger)               |
| `LOG_LEVEL`                                     | `info`        | `trace` \| `debug` \| `info` \| `warn` \| `error`    |
| `CORS_ORIGINS`                                  | `*`           | Comma-separated origins, or `*` for all              |
| `THROTTLE_TTL`                                  | `60`          | Rate limit window in seconds                         |
| `THROTTLE_LIMIT`                                | `100`         | Max requests per window                              |
| `SHUTDOWN_TIMEOUT`                              | `10000`       | Graceful shutdown timeout in ms                      |
| `HEALTH_MEMORY_HEAP_MB`                         | `150`         | Max heap memory in MB for health check               |
| `HEALTH_RSS_MEMORY_MB`                          | `150`         | Max RSS memory in MB for health check                |
| `HEALTH_DISK_THRESHOLD_PERCENT`                 | `0.95`        | Max disk usage (0–1) for health check                |
| `RESILIENCE_RETRY_MAX_ATTEMPTS`                 | `3`           | Default retry attempts                               |
| `RESILIENCE_RETRY_INITIAL_DELAY_MS`             | `128`         | Initial exponential backoff delay in ms              |
| `RESILIENCE_RETRY_MAX_DELAY_MS`                 | `30000`       | Max backoff delay in ms                              |
| `RESILIENCE_TIMEOUT_MS`                         | `5000`        | Default per-attempt timeout in ms                    |
| `RESILIENCE_CIRCUIT_BREAKER_THRESHOLD`          | `5`           | Consecutive failures before the circuit opens        |
| `RESILIENCE_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS` | `10000`       | Time before a half-open trial call                   |
| `RESILIENCE_BULKHEAD_MAX_CONCURRENT`            | `10`          | Max concurrent in-flight calls                       |
| `RESILIENCE_BULKHEAD_MAX_QUEUE`                 | `0`           | Max queued calls beyond the concurrency limit        |

## What's included

### Standardized API responses

Every response — success or error — follows a consistent envelope:

```json
// Success
{ "status": 200, "success": true, "data": {}, "error": null, "timestamp": "..." }

// Error
{ "status": 404, "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "..." }, "timestamp": "..." }
```

`/health/*` and `/metrics` endpoints bypass the envelope. Stack traces are included in errors in non-production environments.

### Health checks

- `GET /health/live` — liveness probe (always returns `{ status: "ok" }`)
- `GET /health/ready` — readiness probe (checks heap memory and disk usage)

### Prometheus metrics

`GET /metrics` exposes:

- `http_requests_total` — counter by method, path, status_code
- `http_request_duration_seconds` — histogram by method, path, status_code
- `resilience_retries_total` — counter by policy
- `resilience_timeouts_total` — counter by policy
- `resilience_circuit_breaker_events_total` — counter by policy, event (`open`/`half_open`/`close`)
- `resilience_bulkhead_rejections_total` — counter by policy
- `resilience_circuit_breaker_state` — gauge by policy (0 closed / 1 half-open / 2 open)

### Zod DTOs and validation

Use `createZodDto` from `nestjs-zod` to define request/response shapes. The global `ZodValidationPipe` validates incoming bodies automatically.

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateItemSchema = z.object({
  id: z.number().int().positive().describe('Item ID').meta({ example: 42 }),
  name: z
    .string()
    .min(1)
    .max(100)
    .describe('Item name')
    .meta({ example: 'My Item' }),
});

export class CreateItemDto extends createZodDto(CreateItemSchema) {}

// Partial schema for PATCH endpoints — all fields become optional
const UpdateItemSchema = CreateItemSchema.partial();
export class UpdateItemDto extends createZodDto(UpdateItemSchema) {}
```

- `.describe()` sets the field description in Swagger
- `.meta({ example: value })` sets the Swagger "Example Value" (use singular `example`, not `examples`)
- `.partial()` / `.partial({ field: true })` derives optional schemas for update endpoints

### `@Log()` decorator

Logs method entry (with args), exit (with result and duration), and errors. Works on sync and async methods.

```typescript
@Log()                            // log args + result
@Log({ args: false })             // skip args
@Log({ result: false })           // skip result
async getItem(id: string) { ... }
```

### `@Resilience()` decorator

Wraps an async method with any combination of **retry**, **timeout**, **circuit breaker**, and **bulkhead** patterns (built on [cockatiel](https://github.com/connor4312/cockatiel)). Patterns always nest in the correct order — `bulkhead → circuitBreaker → timeout → retry → call` — so the timeout applies per attempt.

```typescript
import { Resilience } from './common/resilience';

@Resilience({
  name: 'github-api',                                    // metric/log label; defaults to Class.method
  retry: true,                                           // true = enabled with env defaults
  timeout: { ms: 3000 },                                 // object = override defaults
  circuitBreaker: { threshold: 5, halfOpenAfterMs: 10000 },
  bulkhead: { maxConcurrent: 10, maxQueue: 0 },
})
async fetchUser(id: string): Promise<User> { ... }
```

Each pattern key: omit or `false` to disable, `true` to enable with the `RESILIENCE_*` env defaults, or an object to override specific values.

- **Throws-only:** it reacts to thrown exceptions / rejected promises. A returned neverthrow `err()` is a successful resolution and is **not** retried — throw if a domain error should be retryable.
- **Observability:** resilience events are logged (pino) and exported as Prometheus metrics (see above).
- On failure it throws cockatiel's `BrokenCircuitError` (circuit open), `TaskCancelledError` (timeout), or `BulkheadRejectedError` (bulkhead full).

### Rate limiting

Global `ThrottlerGuard` applies to all routes. Skip per-route with `@SkipThrottle()`. Configured via `THROTTLE_TTL` and `THROTTLE_LIMIT`.

### URI versioning

API versioning is enabled with `VersioningType.URI`. Use `@Version('1')` on controllers or routes to produce `/v1/...` paths.

### Graceful shutdown

Handles `SIGTERM` and `SIGINT`. Waits up to `SHUTDOWN_TIMEOUT` ms for in-flight requests to complete before exiting.

## Project structure

```
src/
  common/
    config/         # Zod-validated config schema and module
    decorators/     # @Log() method decorator
    filters/        # GlobalExceptionFilter
    health/         # /health/live and /health/ready
    interceptors/   # ResponseInterceptor (envelope wrapper)
    logger/         # nestjs-pino setup
    monitoring/     # Prometheus metrics interceptor and module
    resilience/     # @Resilience() decorator (retry, timeout, circuit breaker, bulkhead)
  main.ts           # Bootstrap
  main.config.ts    # App-level config (CORS, helmet, versioning, pipes)
  main.swagger.ts   # Swagger setup
  main.shutdown.ts  # Graceful shutdown
```

## License

MIT
