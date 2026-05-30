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

| Variable                        | Default       | Description                                          |
| ------------------------------- | ------------- | ---------------------------------------------------- |
| `NODE_ENV`                      | `development` | `development` \| `staging` \| `production` \| `test` |
| `PORT`                          | `3000`        | HTTP server port                                     |
| `APP_NAME`                      | `nestjs-app`  | Application name (used in logs)                      |
| `APP_VERSION`                   | `1.0.0`       | Application version (shown in Swagger)               |
| `LOG_LEVEL`                     | `info`        | `trace` \| `debug` \| `info` \| `warn` \| `error`    |
| `CORS_ORIGINS`                  | `*`           | Comma-separated origins, or `*` for all              |
| `THROTTLE_TTL`                  | `60`          | Rate limit window in seconds                         |
| `THROTTLE_LIMIT`                | `100`         | Max requests per window                              |
| `SHUTDOWN_TIMEOUT`              | `10000`       | Graceful shutdown timeout in ms                      |
| `HEALTH_MEMORY_HEAP_MB`         | `150`         | Max heap memory in MB for health check               |
| `HEALTH_RSS_MEMORY_MB`          | `150`         | Max RSS memory in MB for health check                |
| `HEALTH_DISK_THRESHOLD_PERCENT` | `0.95`        | Max disk usage (0–1) for health check                |

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

### `@Log()` decorator

Logs method entry (with args), exit (with result and duration), and errors. Works on sync and async methods.

```typescript
@Log()                            // log args + result
@Log({ args: false })             // skip args
@Log({ result: false })           // skip result
async getItem(id: string) { ... }
```

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
  main.ts           # Bootstrap
  main.config.ts    # App-level config (CORS, helmet, versioning, pipes)
  main.swagger.ts   # Swagger setup
  main.shutdown.ts  # Graceful shutdown
```

## License

MIT
