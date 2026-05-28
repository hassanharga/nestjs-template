# Standardized API Response + Error Handling Design

**Date:** 2026-05-28

## Goals

1. Every endpoint returns the same response envelope (success and error).
2. Services never throw — they return typed `Result<T, AppError>` via `neverthrow`.
3. Controllers have no try/catch — just unwrap and re-throw in one line.
4. One global exception filter handles all error formatting.

---

## Response Envelope

All responses share this shape:

```ts
type ApiResponse<T> = {
  status: number;
  success: boolean;
  data: T | null;
  error: ApiError | null;
  timestamp: string; // ISO 8601
};

type ApiError = {
  code: string;
  message: string;
  stack?: string; // only when NODE_ENV !== 'production'
};
```

**Success example:**
```json
{
  "status": 200,
  "success": true,
  "data": { "id": "1", "name": "Alice" },
  "error": null,
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

**Error example:**
```json
{
  "status": 404,
  "success": false,
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "User not found" },
  "timestamp": "2026-05-28T10:00:00.000Z"
}
```

---

## Components

### 1. Domain Error Classes — `src/common/errors/`

`AppError` is the base class. All domain errors extend it.

```ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  throw(): never {
    throw new HttpException({ code: this.code, message: this.message }, this.httpStatus);
  }
}
```

Pre-built subclasses:

| Class | Code | HTTP Status |
|-------|------|-------------|
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ValidationError` | `VALIDATION_ERROR` | 422 |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ConflictError` | `CONFLICT` | 409 |

All exported from `src/common/errors/index.ts`.

### 2. ResponseInterceptor — `src/common/interceptors/response.interceptor.ts`

A global `NestInterceptor` that wraps every successful controller return value:

```ts
return next.handle().pipe(
  map((data) => ({
    status: response.statusCode,
    success: true,
    data: data ?? null,
    error: null,
    timestamp: new Date().toISOString(),
  })),
);
```

Skips `/metrics` path (same pattern as `HttpMetricsInterceptor`).

### 3. Single ExceptionFilter — `src/common/filters/exception.filter.ts`

Replaces both `HttpExceptionFilter` and `AllExceptionsFilter`. Uses `@Catch()` (catches everything).

Logic:
- If `exception instanceof HttpException`: read status + structured body from it.
- Otherwise: status = 500, code = `INTERNAL_SERVER_ERROR`, message = `Internal server error`.
- In non-production: include `stack` in the error object.

Response shape:
```ts
response.status(status).json({
  status,
  success: false,
  data: null,
  error: { code, message, ...(isDev && { stack }) },
  timestamp: new Date().toISOString(),
});
```

Old filter files (`http-exception.filter.ts`, `all-exceptions.filter.ts`) and their specs are deleted.

### 4. Registration — `app.module.ts`

Both are registered globally via NestJS DI tokens in `app.module.ts` — the same pattern as the existing filters:

```ts
{ provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
{ provide: APP_FILTER, useClass: ExceptionFilter },
```

This keeps `ConfigService` available via injection (needed for `NODE_ENV` check in the filter) and is consistent with how `ThrottlerGuard` and the old filters are wired.

---

## Data Flow

```
Request
  → Guards / Pipes (ZodValidationPipe throws HttpException on bad input)
  → ResponseInterceptor (wraps Observable)
  → Controller (calls service, unwraps Result, re-throws on Err)
  → Service (returns Result<T, AppError> — never throws)

On success:
  Controller return value → ResponseInterceptor.map() → { success: true, data }

On error (any point in pipeline):
  Thrown exception → ExceptionFilter → { success: false, error }
```

---

## Usage Patterns

**Service:**
```ts
import { ok, err, Result } from 'neverthrow';

async findUser(id: string): Promise<Result<User, AppError>> {
  const user = await this.repo.findById(id);
  if (!user) return err(new NotFoundError('User not found'));
  return ok(user);
}
```

**Controller:**
```ts
@Get(':id')
async getUser(@Param('id') id: string) {
  const result = await this.userService.findUser(id);
  if (result.isErr()) result.error.throw();
  return result.value;
}
```

No try/catch. No manual response shaping.

---

## Files to Create

- `src/common/errors/app.error.ts`
- `src/common/errors/index.ts`
- `src/common/interceptors/response.interceptor.ts`
- `src/common/interceptors/response.interceptor.spec.ts`
- `src/common/filters/exception.filter.ts`
- `src/common/filters/exception.filter.spec.ts`

## Files to Modify

- `src/app.module.ts` — replace old `APP_FILTER` providers with new filter + add `APP_INTERCEPTOR`

## Files to Delete

- `src/common/filters/http-exception.filter.ts`
- `src/common/filters/http-exception.filter.spec.ts`
- `src/common/filters/all-exceptions.filter.ts`
- `src/common/filters/all-exceptions.filter.spec.ts`

---

## Dependencies

Add `neverthrow` to production dependencies:
```bash
pnpm add neverthrow
```
