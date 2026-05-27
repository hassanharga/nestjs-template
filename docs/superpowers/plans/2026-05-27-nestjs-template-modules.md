# NestJS Template Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add config, logger, request-ID, error-handling, graceful-shutdown, health, monitoring, validation, Swagger, and security modules to the bare NestJS v11 scaffold so every future project starts production-ready.

**Architecture:** Each infrastructure concern lives in `src/common/<name>/` as a self-contained NestJS module. `AppModule` imports them all; `main.ts` registers global filters, pipes, middleware, and Swagger. Dependency order: Config → Logger → RequestId → Filters → Health → Monitoring → wire AppModule → wire main.ts.

**Tech Stack:** `@nestjs/config` + `zod`, `nestjs-pino` + `pino-http`, `@nestjs/terminus`, `@willsoto/nestjs-prometheus` + `prom-client`, `nestjs-zod`, `@nestjs/swagger`, `helmet`, `@nestjs/throttler`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/common/config/config.schema.ts` | Create | Zod schema — validates all env vars |
| `src/common/config/config.module.ts` | Create | Global ConfigModule wrapping `@nestjs/config` |
| `src/common/config/config.schema.spec.ts` | Create | Unit tests for the Zod schema |
| `src/common/logger/logger.module.ts` | Create | nestjs-pino logger, dev pretty / prod JSON |
| `src/common/request-id/request-id.middleware.ts` | Create | Reads/generates `x-request-id`, sets `req.id` |
| `src/common/request-id/request-id.middleware.spec.ts` | Create | Unit tests for the middleware |
| `src/common/filters/http-exception.filter.ts` | Create | Formats `HttpException` → consistent error body |
| `src/common/filters/http-exception.filter.spec.ts` | Create | Unit tests for the filter |
| `src/common/filters/all-exceptions.filter.ts` | Create | Catches everything else → 500 |
| `src/common/filters/all-exceptions.filter.spec.ts` | Create | Unit tests for the filter |
| `src/common/health/health.controller.ts` | Create | `GET /health/live` and `GET /health/ready` |
| `src/common/health/health.module.ts` | Create | TerminusModule + HealthController |
| `src/common/health/health.controller.spec.ts` | Create | Unit tests |
| `src/common/monitoring/http-metrics.interceptor.ts` | Create | Records request count + duration to Prometheus |
| `src/common/monitoring/http-metrics.interceptor.spec.ts` | Create | Unit tests |
| `src/common/monitoring/monitoring.module.ts` | Create | PrometheusModule + custom metrics + interceptor |
| `src/app.module.ts` | Modify | Import all common modules + ThrottlerModule |
| `src/main.ts` | Modify | Full bootstrap: reflect-metadata, helmet, CORS, pipes, filters, logger, Swagger, shutdown |
| `.env.example` | Create | Documents all environment variables |

---

## Task 1: Install dependencies

- [ ] **Step 1: Install runtime dependencies**

```bash
pnpm add @nestjs/config zod nestjs-pino pino-http @nestjs/terminus @willsoto/nestjs-prometheus prom-client nestjs-zod @nestjs/swagger helmet @nestjs/throttler
```

- [ ] **Step 2: Install dev dependencies**

```bash
pnpm add -D pino-pretty @types/express
```

- [ ] **Step 3: Verify no peer dependency errors**

```bash
pnpm install
```

Expected: no errors, `node_modules` updated.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: install infrastructure dependencies"
```

---

## Task 2: Config module

**Files:**
- Create: `src/common/config/config.schema.ts`
- Create: `src/common/config/config.module.ts`
- Create: `src/common/config/config.schema.spec.ts`

- [ ] **Step 1: Write the failing tests for the config schema**

Create `src/common/config/config.schema.spec.ts`:

```typescript
import { configSchema } from './config.schema';

describe('configSchema', () => {
  it('applies defaults for all optional vars', () => {
    const result = configSchema.parse({});
    expect(result.PORT).toBe(3000);
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.NODE_ENV).toBe('development');
    expect(result.CORS_ORIGINS).toBe('*');
    expect(result.THROTTLE_TTL).toBe(60);
    expect(result.THROTTLE_LIMIT).toBe(100);
    expect(result.APP_NAME).toBe('nestjs-app');
    expect(result.APP_VERSION).toBe('1.0.0');
    expect(result.SHUTDOWN_TIMEOUT).toBe(10000);
  });

  it('coerces PORT from string to number', () => {
    const result = configSchema.parse({ PORT: '8080' });
    expect(result.PORT).toBe(8080);
  });

  it('throws for invalid NODE_ENV value', () => {
    expect(() => configSchema.parse({ NODE_ENV: 'invalid' })).toThrow();
  });

  it('throws for invalid LOG_LEVEL value', () => {
    expect(() => configSchema.parse({ LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('coerces THROTTLE_TTL and THROTTLE_LIMIT from strings', () => {
    const result = configSchema.parse({ THROTTLE_TTL: '30', THROTTLE_LIMIT: '50' });
    expect(result.THROTTLE_TTL).toBe(30);
    expect(result.THROTTLE_LIMIT).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/common/config/config.schema.spec.ts
```

Expected: FAIL — `Cannot find module './config.schema'`

- [ ] **Step 3: Create the Zod schema**

Create `src/common/config/config.schema.ts`:

```typescript
import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('*'),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  APP_NAME: z.string().default('nestjs-app'),
  APP_VERSION: z.string().default('1.0.0'),
  SHUTDOWN_TIMEOUT: z.coerce.number().int().positive().default(10000),
});

export type AppConfig = z.infer<typeof configSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/common/config/config.schema.spec.ts
```

Expected: PASS — 5 tests passing.

- [ ] **Step 5: Create the config module**

Create `src/common/config/config.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configSchema } from './config.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`, '.env.local'],
      validate: (config) => configSchema.parse(config),
    }),
  ],
})
export class AppConfigModule {}
```

- [ ] **Step 6: Commit**

```bash
git add src/common/config/
git commit -m "feat: add config module with Zod validation"
```

---

## Task 3: Logger module

**Files:**
- Create: `src/common/logger/logger.module.ts`

No unit test needed — `nestjs-pino` integration is tested at the E2E level (the logger is verified during full app boot in Task 10).

- [ ] **Step 1: Create the logger module**

Create `src/common/logger/logger.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') === 'development';
        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL', 'info'),
            transport: isDev
              ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
              : undefined,
            autoLogging: true,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
```

- [ ] **Step 2: Commit**

```bash
git add src/common/logger/
git commit -m "feat: add Pino logger module"
```

---

## Task 4: Request ID middleware

**Files:**
- Create: `src/common/request-id/request-id.middleware.ts`
- Create: `src/common/request-id/request-id.middleware.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/request-id/request-id.middleware.spec.ts`:

```typescript
import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('uses x-request-id header when present', () => {
    const req = { headers: { 'x-request-id': 'my-trace-id' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBe('my-trace-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'my-trace-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID when x-request-id header is absent', () => {
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('generates a different UUID for each request', () => {
    const req1 = { headers: {} } as any;
    const req2 = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    middleware.use(req1, res, jest.fn());
    middleware.use(req2, res, jest.fn());

    expect(req1.id).not.toBe(req2.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/common/request-id/request-id.middleware.spec.ts
```

Expected: FAIL — `Cannot find module './request-id.middleware'`

- [ ] **Step 3: Implement the middleware**

Create `src/common/request-id/request-id.middleware.ts`:

```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.id = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/common/request-id/request-id.middleware.spec.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/common/request-id/
git commit -m "feat: add request ID middleware"
```

---

## Task 5: HTTP exception filter

**Files:**
- Create: `src/common/filters/http-exception.filter.ts`
- Create: `src/common/filters/http-exception.filter.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/filters/http-exception.filter.spec.ts`:

```typescript
import { HttpExceptionFilter } from './http-exception.filter';
import { NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';

function buildHost(url: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as any,
    json,
    status,
  };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('returns 404 with correct shape for NotFoundException', () => {
    const { host, json, status } = buildHost('/api/users/99');

    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'User not found',
        path: '/api/users/99',
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('returns 401 for UnauthorizedException', () => {
    const { host, status } = buildHost('/api/secret');
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 400 for BadRequestException', () => {
    const { host, status } = buildHost('/api/submit');
    filter.catch(new BadRequestException('Validation failed'), host);
    expect(status).toHaveBeenCalledWith(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/common/filters/http-exception.filter.spec.ts
```

Expected: FAIL — `Cannot find module './http-exception.filter'`

- [ ] **Step 3: Implement the filter**

Create `src/common/filters/http-exception.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : ((exceptionResponse as Record<string, unknown>).message as string);

    response.status(status).json({
      statusCode: status,
      message: message ?? exception.message,
      error: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/common/filters/http-exception.filter.spec.ts
```

Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/common/filters/http-exception.filter.ts src/common/filters/http-exception.filter.spec.ts
git commit -m "feat: add HTTP exception filter"
```

---

## Task 6: All-exceptions filter

**Files:**
- Create: `src/common/filters/all-exceptions.filter.ts`
- Create: `src/common/filters/all-exceptions.filter.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/filters/all-exceptions.filter.spec.ts`:

```typescript
import { AllExceptionsFilter } from './all-exceptions.filter';

function buildHost(url: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as any,
    json,
    status,
  };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('returns 500 for an unknown Error', () => {
    const { host, json, status } = buildHost('/api/boom');

    filter.catch(new Error('Something exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
        path: '/api/boom',
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('returns 500 for a thrown string', () => {
    const { host, status } = buildHost('/api/boom');
    filter.catch('something broke', host);
    expect(status).toHaveBeenCalledWith(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test src/common/filters/all-exceptions.filter.spec.ts
```

Expected: FAIL — `Cannot find module './all-exceptions.filter'`

- [ ] **Step 3: Implement the filter**

Create `src/common/filters/all-exceptions.filter.ts`:

```typescript
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test src/common/filters/all-exceptions.filter.spec.ts
```

Expected: PASS — 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/common/filters/all-exceptions.filter.ts src/common/filters/all-exceptions.filter.spec.ts
git commit -m "feat: add all-exceptions filter"
```

---

## Task 7: Health module

**Files:**
- Create: `src/common/health/health.controller.ts`
- Create: `src/common/health/health.module.ts`
- Create: `src/common/health/health.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/common/health/health.controller.spec.ts`:

```typescript
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController(null as any, null as any, null as any);
  });

  it('GET /health/live returns { status: ok }', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/common/health/health.controller.spec.ts
```

Expected: FAIL — `Cannot find module './health.controller'`

- [ ] **Step 3: Create the health controller**

Create `src/common/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }
}
```

- [ ] **Step 4: Create the health module**

Create `src/common/health/health.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm test src/common/health/health.controller.spec.ts
```

Expected: PASS — 1 test passing.

- [ ] **Step 6: Commit**

```bash
git add src/common/health/
git commit -m "feat: add health module with liveness and readiness endpoints"
```

---

## Task 8: Monitoring module

**Files:**
- Create: `src/common/monitoring/http-metrics.interceptor.ts`
- Create: `src/common/monitoring/http-metrics.interceptor.spec.ts`
- Create: `src/common/monitoring/monitoring.module.ts`

- [ ] **Step 1: Write the failing test for the interceptor**

Create `src/common/monitoring/http-metrics.interceptor.spec.ts`:

```typescript
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { of } from 'rxjs';

describe('HttpMetricsInterceptor', () => {
  it('increments the request counter and records duration on successful response', (done) => {
    const endTimer = jest.fn();
    const counter = { inc: jest.fn() };
    const histogram = { startTimer: jest.fn().mockReturnValue(endTimer) };

    const interceptor = new HttpMetricsInterceptor(counter as any, histogram as any);

    const req = { method: 'GET', path: '/test' };
    const res = { statusCode: 200 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;
    const handler = { handle: () => of('result') };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(histogram.startTimer).toHaveBeenCalledWith({ method: 'GET', path: '/test' });
        expect(counter.inc).toHaveBeenCalledWith({
          method: 'GET',
          path: '/test',
          status_code: '200',
        });
        expect(endTimer).toHaveBeenCalledWith({
          method: 'GET',
          path: '/test',
          status_code: '200',
        });
        done();
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/common/monitoring/http-metrics.interceptor.spec.ts
```

Expected: FAIL — `Cannot find module './http-metrics.interceptor'`

- [ ] **Step 3: Create the HTTP metrics interceptor**

Create `src/common/monitoring/http-metrics.interceptor.ts`:

```typescript
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total') private readonly counter: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const endTimer = this.histogram.startTimer({ method: req.method, path: req.path });

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const labels = { method: req.method, path: req.path, status_code: String(res.statusCode) };
        this.counter.inc(labels);
        endTimer(labels);
      }),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test src/common/monitoring/http-metrics.interceptor.spec.ts
```

Expected: PASS — 1 test passing.

- [ ] **Step 5: Create the monitoring module**

Create `src/common/monitoring/monitoring.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
      path: '/metrics',
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    HttpMetricsInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class MonitoringModule {}
```

- [ ] **Step 6: Commit**

```bash
git add src/common/monitoring/
git commit -m "feat: add Prometheus monitoring module with HTTP metrics interceptor"
```

---

## Task 9: Update AppModule

**Files:**
- Modify: `src/app.module.ts`

- [ ] **Step 1: Replace AppModule contents**

Replace `src/app.module.ts` with:

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/config.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { HealthModule } from './common/health/health.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { RequestIdMiddleware } from './common/request-id/request-id.middleware';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    HealthModule,
    MonitoringModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 2: Run existing unit tests to confirm nothing broke**

```bash
pnpm test src/app.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: wire all common modules into AppModule"
```

---

## Task 10: Update main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts**

Replace `src/main.ts` with:

```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { patchNestJsSwagger, ZodValidationPipe } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  patchNestJsSwagger();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const appName = config.get<string>('APP_NAME', 'nestjs-app');
  const appVersion = config.get<string>('APP_VERSION', '1.0.0');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');
  const shutdownTimeout = config.get<number>('SHUTDOWN_TIMEOUT', 10000);

  app.use(helmet());

  app.enableCors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  // AllExceptionsFilter registered first — NestJS applies last-registered first,
  // so HttpExceptionFilter runs first (handles known HTTP errors), then AllExceptionsFilter (catches the rest).
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.useLogger(app.get(Logger));

  if (nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(appName)
        .setVersion(appVersion)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    setTimeout(() => process.exit(1), shutdownTimeout).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen(port);
}

bootstrap();
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire full bootstrap in main.ts (helmet, CORS, pipes, filters, logger, Swagger, shutdown)"
```

---

## Task 11: Create .env.example

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create .env.example**

Create `.env.example`:

```dotenv
# Application
NODE_ENV=development
PORT=3000
APP_NAME=nestjs-app
APP_VERSION=1.0.0

# Logging — trace | debug | info | warn | error
LOG_LEVEL=info

# CORS — comma-separated allowed origins, or * to allow all
CORS_ORIGINS=*

# Rate limiting — TTL in seconds, max requests per TTL window
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Graceful shutdown — ms to wait before force-killing after SIGTERM
SHUTDOWN_TIMEOUT=10000
```

- [ ] **Step 2: Copy to .env for local development**

```bash
cp .env.example .env
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add .env.example with all environment variables documented"
```

---

## Task 12: Full verification

- [ ] **Step 1: Run all unit tests**

```bash
pnpm test
```

Expected: All tests pass. No failures.

- [ ] **Step 2: Build the project**

```bash
pnpm run build
```

Expected: Compiles to `dist/` with no TypeScript errors.

- [ ] **Step 3: Start the dev server**

```bash
pnpm run start:dev
```

Expected: Server starts on port 3000. Pino pretty-prints logs in dev mode. No startup errors.

- [ ] **Step 4: Verify liveness endpoint**

```bash
curl -s http://localhost:3000/health/live | jq .
```

Expected:
```json
{ "status": "ok" }
```

- [ ] **Step 5: Verify readiness endpoint**

```bash
curl -s http://localhost:3000/health/ready | jq .
```

Expected: `{ "status": "ok", "info": { ... }, "error": {}, "details": { ... } }`

- [ ] **Step 6: Verify Prometheus metrics**

```bash
curl -s http://localhost:3000/metrics | head -20
```

Expected: Prometheus text format with Node.js default metrics (lines starting with `# HELP`, `# TYPE`).

- [ ] **Step 7: Make a request then verify HTTP metrics appear**

```bash
curl -s http://localhost:3000/health/live > /dev/null
curl -s http://localhost:3000/metrics | grep http_requests_total
```

Expected: `http_requests_total{...} 1` (or higher).

- [ ] **Step 8: Verify error response shape**

```bash
curl -s http://localhost:3000/nonexistent | jq .
```

Expected:
```json
{
  "statusCode": 404,
  "message": "Cannot GET /nonexistent",
  "error": "Not Found",
  "path": "/nonexistent",
  "timestamp": "..."
}
```

- [ ] **Step 9: Verify request ID propagation**

```bash
curl -sv -H "x-request-id: trace-abc-123" http://localhost:3000/health/live 2>&1 | grep -i x-request-id
```

Expected: `< x-request-id: trace-abc-123` in the response headers.

- [ ] **Step 10: Verify Swagger UI**

Open `http://localhost:3000/api/docs` in a browser.

Expected: Swagger UI loads with app name and version. Bearer auth button is visible.

- [ ] **Step 11: Verify config validation rejects bad env vars**

```bash
NODE_ENV=invalid pnpm run start:dev 2>&1 | head -20
```

Expected: App crashes immediately with a Zod validation error describing the invalid `NODE_ENV` value.

- [ ] **Step 12: Final commit**

```bash
git add -A
git commit -m "chore: verified all modules working end-to-end"
```
