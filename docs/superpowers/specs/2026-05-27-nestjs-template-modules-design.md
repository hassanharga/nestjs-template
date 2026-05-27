# NestJS Template Modules Design

**Date:** 2026-05-27  
**Status:** Approved

## Context

This template is a fresh NestJS v11 scaffold intended to be reused across future projects. The goal is to add a set of production-ready cross-cutting infrastructure modules — logger, configuration, health, monitoring, error handling, graceful shutdown, validation, Swagger, security, and request ID — so every new project starts with a solid foundation rather than rebuilding these from scratch.

Deployment target is undecided; design defaults to Docker/Kubernetes conventions (structured JSON logs, liveness/readiness probes, SIGTERM shutdown) while staying portable.

---

## Structure

All infrastructure lives under `src/common/`. Each concern is its own NestJS module (or utility). `AppModule` imports them individually. This makes modules portable — any module can be lifted out and dropped into another project.

```
src/
  common/
    config/
      config.module.ts
      config.schema.ts
    logger/
      logger.module.ts
    health/
      health.module.ts
      health.controller.ts
    monitoring/
      monitoring.module.ts
      http-metrics.interceptor.ts
    filters/
      all-exceptions.filter.ts
      http-exception.filter.ts
    request-id/
      request-id.middleware.ts
  app.module.ts
  main.ts
.env.example
```

---

## Modules

### 1. Config (`src/common/config/`)

**Library:** `@nestjs/config` + `zod`

- Loads `.env`, `.env.development`, `.env.production` via `@nestjs/config` with `ignoreEnvFile: false`
- `config.schema.ts` defines a Zod schema that validates all env vars at startup; the app refuses to start if validation fails
- Registered as global module so `ConfigService` is injectable everywhere without re-importing
- `.env.example` documents every required and optional variable

**Env vars:**

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `staging`, `production` |
| `PORT` | no | `3000` | HTTP listen port |
| `LOG_LEVEL` | no | `info` | `trace`, `debug`, `info`, `warn`, `error` |
| `CORS_ORIGINS` | no | `*` | Comma-separated allowed origins |
| `THROTTLE_TTL` | no | `60` | Rate limit window in seconds |
| `THROTTLE_LIMIT` | no | `100` | Max requests per window |
| `APP_NAME` | no | `nestjs-app` | Used in Swagger title |
| `APP_VERSION` | no | `1.0.0` | Used in Swagger version |
| `SHUTDOWN_TIMEOUT` | no | `10000` | Grace period in ms before hard kill |

---

### 2. Logger (`src/common/logger/`)

**Libraries:** `nestjs-pino`, `pino-http`, `pino-pretty` (devDependency)

- `nestjs-pino` replaces NestJS's default logger globally
- `pino-http` attaches a child logger to every request, automatically including `req.id` in all log lines within that request context
- Log level driven by `LOG_LEVEL` env var
- In `development`: pretty-prints via `pino-pretty` transport
- In `production`: raw JSON to stdout (for log aggregators — Datadog, ELK, etc.)
- `main.ts` calls `app.useLogger(app.get(Logger))` after app creation
- Services inject `Logger` from `@nestjs/common` — no logger-specific import needed

---

### 3. Health (`src/common/health/`)

**Library:** `@nestjs/terminus`

Two endpoints:

- `GET /health/live` — liveness: returns `200 { status: 'ok' }` if the process is running
- `GET /health/ready` — readiness: runs terminus health indicators (memory heap < 150MB, disk < 90%); extensible by adding DB/Redis checks per project

Response shape (Terminus standard):
```json
{
  "status": "ok",
  "info": { "memory_heap": { "status": "up" } },
  "error": {},
  "details": { "memory_heap": { "status": "up" } }
}
```

These endpoints are excluded from the global throttler guard and response interceptors.

---

### 4. Monitoring (`src/common/monitoring/`)

**Library:** `@willsoto/nestjs-prometheus`

- `GET /metrics` — Prometheus scrape endpoint (plain text format)
- Default Node.js metrics collected automatically: GC, event loop lag, memory, active handles
- `HttpMetricsInterceptor` (registered globally) records per-request:
  - `http_requests_total` counter — labels: `method`, `path`, `status_code`
  - `http_request_duration_seconds` histogram — labels: `method`, `path`, `status_code`
- `/metrics` endpoint excluded from the HTTP metrics interceptor to avoid self-measurement

---

### 5. Error Handling (`src/common/filters/`)

Two global exception filters registered in `main.ts`:

- `HttpExceptionFilter` — handles `HttpException` and all its subclasses (404, 400, 401, etc.)
- `AllExceptionsFilter` — catches everything else → 500 Internal Server Error

Consistent error response shape:
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "path": "/api/users/99",
  "timestamp": "2026-05-27T10:00:00.000Z"
}
```

- Errors are logged via Pino: stack trace included at `error` level in development, message-only in production
- Filter registration order in `main.ts`: `AllExceptionsFilter` first, `HttpExceptionFilter` second (NestJS applies last-registered first)

---

### 6. Graceful Shutdown (`main.ts`)

- `app.enableShutdownHooks()` — NestJS intercepts SIGTERM/SIGINT and calls `onModuleDestroy()` on all providers
- Hard-kill timeout: after `SHUTDOWN_TIMEOUT` ms (default 10000), `process.exit(1)` is called
- Pino's async destination is flushed on `process.on('exit')` to avoid losing buffered log lines

---

### 7. Validation (`main.ts` — global pipe)

**Library:** `nestjs-zod`

- `ZodValidationPipe` registered globally via `app.useGlobalPipes()`
- DTOs are defined using `createZodDto(zodSchema)` — no `class-validator` decorators needed
- `patchNestJsSwagger()` called before Swagger setup so Swagger generates correct schemas from Zod types
- Validation errors: 400 with field-level detail (`{ field, message }` per invalid field)

---

### 8. Swagger (`main.ts`)

**Library:** `@nestjs/swagger`

- Available at `/api/docs` in `development` and `staging` only (`NODE_ENV !== 'production'`)
- Title from `APP_NAME`, version from `APP_VERSION`
- Bearer auth (`Authorization: Bearer <token>`) preconfigured in Swagger UI
- `patchNestJsSwagger()` (from `nestjs-zod`) called first so Zod DTOs generate correct OpenAPI schemas

---

### 9. Security

**Libraries:** `helmet`, `@nestjs/throttler`

Security is split across two locations:

- **`main.ts`:** `helmet()` middleware (HTTP security headers) and `app.enableCors()` (origins from `CORS_ORIGINS` env var, comma-split; `*` in development) — applied before any routes
- **`AppModule`:** imports `ThrottlerModule.forRootAsync()` configured from `THROTTLE_TTL` / `THROTTLE_LIMIT` via `ConfigService`; `ThrottlerGuard` registered as a global guard via `APP_GUARD`
- Health and metrics endpoints decorated with `@SkipThrottle()` since they are called at high frequency by orchestrators

No separate `security.module.ts` is needed — `ThrottlerModule` is imported directly in `AppModule`.

---

### 10. Request ID (`src/common/request-id/`)

- `RequestIdMiddleware` applied globally to all routes
- Logic: if `x-request-id` request header is present, reuse it; otherwise generate UUID v4
- Sets `request.id` (picked up automatically by `pino-http` for log correlation)
- Echoes the ID back in response header `x-request-id`
- Enables log tracing across distributed services when request IDs are propagated

---

## `main.ts` Bootstrap Order

Order matters — each step depends on what came before:

```
1.  import 'reflect-metadata'                         ← must be first line
2.  NestFactory.create(AppModule, { bufferLogs: true })
3.  app.use(helmet())
4.  app.enableCors({ origin: CORS_ORIGINS })
5.  app.useGlobalPipes(new ZodValidationPipe())
6.  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter())
7.  app.useLogger(app.get(Logger))                    ← after bufferLogs, flushes buffered logs
8.  patchNestJsSwagger() + SwaggerModule.setup()      ← non-prod only
9.  app.enableShutdownHooks()
10. app.listen(PORT)
```

---

## Dependencies to Install

**Runtime:**
```
@nestjs/config
zod
nestjs-pino
pino-http
@nestjs/terminus
@willsoto/nestjs-prometheus
prom-client
nestjs-zod
@nestjs/swagger
helmet
@nestjs/throttler
uuid
```

**Dev:**
```
pino-pretty
@types/uuid
```

---

## Verification

After implementation, verify end-to-end:

1. **Boot:** `pnpm run start:dev` — app starts, Pino JSON logs appear, no startup errors
2. **Config validation:** remove a required env var → app should refuse to start with a clear Zod error
3. **Health:** `curl localhost:3000/health/live` → `{ status: 'ok' }`, `curl localhost:3000/health/ready` → terminus response
4. **Metrics:** `curl localhost:3000/metrics` → Prometheus text format with Node.js default metrics + HTTP metrics after making a request
5. **Error handling:** `curl localhost:3000/nonexistent` → `{ statusCode: 404, message: ..., path: ..., timestamp: ... }`
6. **Validation:** POST with invalid body → 400 with Zod field-level errors
7. **Swagger:** open `http://localhost:3000/api/docs` → UI loads with bearer auth
8. **Request ID:** `curl -H "x-request-id: my-id" localhost:3000/health/live` → response header contains `x-request-id: my-id`
9. **Throttle:** send 101 requests in 60s to any endpoint → 429 on the 101st
10. **Shutdown:** `kill -SIGTERM <pid>` → app logs shutdown, exits cleanly within timeout
11. **Run tests:** `pnpm run test` → all pass; `pnpm run build` → compiles without errors
