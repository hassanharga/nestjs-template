# Standardized API Response + Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a uniform `{ status, success, data, error, timestamp }` response envelope to every endpoint, with typed domain errors via `neverthrow` so services never throw and controllers need no try/catch.

**Architecture:** A global `ResponseInterceptor` wraps successful returns; a global `GlobalExceptionFilter` (replacing both existing filters) formats all errors. Services return `Result<T, AppError>` from `neverthrow`; controllers unwrap with `if (result.isErr()) result.error.throw()`.

**Tech Stack:** NestJS 11, `neverthrow`, TypeScript 5.7, Jest, pnpm

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/common/errors/app.error.ts` | `AppError` base class + 5 subclasses |
| Create | `src/common/errors/app.error.spec.ts` | Unit tests for error classes |
| Create | `src/common/errors/index.ts` | Barrel export |
| Create | `src/common/interceptors/response.interceptor.ts` | Wraps success responses |
| Create | `src/common/interceptors/response.interceptor.spec.ts` | Unit tests |
| Create | `src/common/filters/exception.filter.ts` | Unified exception filter |
| Create | `src/common/filters/exception.filter.spec.ts` | Unit tests |
| Modify | `src/app.module.ts` | Register new providers, remove old ones |
| Modify | `test/app.e2e-spec.ts` | Update assertion for new response shape |
| Delete | `src/common/filters/http-exception.filter.ts` | Replaced |
| Delete | `src/common/filters/http-exception.filter.spec.ts` | Replaced |
| Delete | `src/common/filters/all-exceptions.filter.ts` | Replaced |
| Delete | `src/common/filters/all-exceptions.filter.spec.ts` | Replaced |

---

## Task 1: Install neverthrow

**Files:**
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Add neverthrow as a production dependency**

```bash
pnpm add neverthrow
```

Expected output: `+ neverthrow <version>` in the summary.

- [ ] **Step 2: Verify it resolves**

```bash
node -e "require('neverthrow'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add neverthrow dependency"
```

---

## Task 2: Domain Error Classes

**Files:**
- Create: `src/common/errors/app.error.ts`
- Create: `src/common/errors/app.error.spec.ts`
- Create: `src/common/errors/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/errors/app.error.spec.ts`:

```ts
import { HttpException } from '@nestjs/common';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './app.error';

describe('AppError', () => {
  it('stores code, message, httpStatus, and sets name to class name', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('my message');
    expect(err.httpStatus).toBe(418);
    expect(err.name).toBe('AppError');
  });

  it('throw() raises HttpException with the correct status', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    expect(() => err.throw()).toThrow(HttpException);
  });

  it('throw() puts code and message in the HttpException body', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    try {
      err.throw();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(418);
      expect((e as HttpException).getResponse()).toEqual({
        code: 'MY_CODE',
        message: 'my message',
      });
    }
  });
});

describe('NotFoundError', () => {
  it('has code NOT_FOUND and status 404', () => {
    const err = new NotFoundError('User not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.message).toBe('User not found');
  });

  it('uses default message when none provided', () => {
    expect(new NotFoundError().message).toBe('Not found');
  });
});

describe('ValidationError', () => {
  it('has code VALIDATION_ERROR and status 422', () => {
    const err = new ValidationError();
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.httpStatus).toBe(422);
  });
});

describe('UnauthorizedError', () => {
  it('has code UNAUTHORIZED and status 401', () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.httpStatus).toBe(401);
  });
});

describe('ForbiddenError', () => {
  it('has code FORBIDDEN and status 403', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe('FORBIDDEN');
    expect(err.httpStatus).toBe(403);
  });
});

describe('ConflictError', () => {
  it('has code CONFLICT and status 409', () => {
    const err = new ConflictError();
    expect(err.code).toBe('CONFLICT');
    expect(err.httpStatus).toBe(409);
  });
});
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
pnpm test -- --testPathPattern="app.error.spec"
```

Expected: FAIL — `Cannot find module './app.error'`

- [ ] **Step 3: Implement app.error.ts**

Create `src/common/errors/app.error.ts`:

```ts
import { HttpException } from '@nestjs/common';

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
    throw new HttpException(
      { code: this.code, message: this.message },
      this.httpStatus,
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super('VALIDATION_ERROR', message, 422);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message, 409);
  }
}
```

- [ ] **Step 4: Create the barrel export**

Create `src/common/errors/index.ts`:

```ts
export * from './app.error';
```

- [ ] **Step 5: Run the tests — expect them to pass**

```bash
pnpm test -- --testPathPattern="app.error.spec"
```

Expected: PASS — 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/common/errors/
git commit -m "feat: add AppError domain error classes"
```

---

## Task 3: ResponseInterceptor

**Files:**
- Create: `src/common/interceptors/response.interceptor.ts`
- Create: `src/common/interceptors/response.interceptor.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/interceptors/response.interceptor.spec.ts`:

```ts
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

function buildContext(path: string, statusCode = 200) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path }),
      getResponse: () => ({ statusCode }),
    }),
  } as any;
}

function buildHandler(returnValue: unknown) {
  return { handle: () => of(returnValue) } as any;
}

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('wraps data in the success envelope', (done) => {
    interceptor
      .intercept(buildContext('/api/users', 200), buildHandler({ id: 1 }))
      .subscribe((result) => {
        expect(result).toMatchObject({
          status: 200,
          success: true,
          data: { id: 1 },
          error: null,
        });
        expect((result as any).timestamp).toBeDefined();
        done();
      });
  });

  it('maps null data to null in the envelope', (done) => {
    interceptor
      .intercept(buildContext('/api/users', 204), buildHandler(null))
      .subscribe((result) => {
        expect((result as any).data).toBeNull();
        done();
      });
  });

  it('maps undefined data to null in the envelope', (done) => {
    interceptor
      .intercept(buildContext('/api/users', 200), buildHandler(undefined))
      .subscribe((result) => {
        expect((result as any).data).toBeNull();
        done();
      });
  });

  it('passes through /metrics without wrapping', (done) => {
    interceptor
      .intercept(buildContext('/metrics', 200), buildHandler('raw-metrics-data'))
      .subscribe((result) => {
        expect(result).toBe('raw-metrics-data');
        done();
      });
  });
});
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
pnpm test -- --testPathPattern="response.interceptor.spec"
```

Expected: FAIL — `Cannot find module './response.interceptor'`

- [ ] **Step 3: Implement response.interceptor.ts**

Create `src/common/interceptors/response.interceptor.ts`:

```ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ path: string }>();
    if (req.path === '/metrics') {
      return next.handle();
    }

    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data) => ({
        status: res.statusCode,
        success: true,
        data: data ?? null,
        error: null,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

- [ ] **Step 4: Run the tests — expect them to pass**

```bash
pnpm test -- --testPathPattern="response.interceptor.spec"
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/common/interceptors/
git commit -m "feat: add ResponseInterceptor for success envelope"
```

---

## Task 4: GlobalExceptionFilter

**Files:**
- Create: `src/common/filters/exception.filter.ts`
- Create: `src/common/filters/exception.filter.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/common/filters/exception.filter.spec.ts`:

```ts
import {
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './exception.filter';

function mockConfig(nodeEnv = 'test') {
  return {
    get: jest.fn((key: string, def?: string) =>
      key === 'NODE_ENV' ? nodeEnv : def,
    ),
  } as any;
}

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

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter(mockConfig());
  });

  it('formats AppError-sourced HttpException with its code', () => {
    const { host, json, status } = buildHost('/api/users/99');
    const exception = new HttpException(
      { code: 'NOT_FOUND', message: 'User not found' },
      404,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        success: false,
        data: null,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'User not found',
        }),
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('formats NestJS NotFoundException with derived code', () => {
    const { host, json, status } = buildHost('/api/users/99');

    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 404,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'User not found',
      }),
    });
  });

  it('formats NestJS UnauthorizedException', () => {
    const { host, status } = buildHost('/api/secret');
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('formats unknown Error as 500 INTERNAL_SERVER_ERROR', () => {
    const { host, json, status } = buildHost('/api/boom');

    filter.catch(new Error('Something exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 500,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    });
  });

  it('formats thrown non-Error as 500', () => {
    const { host, status } = buildHost('/api/boom');
    filter.catch('something broke', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('includes stack in error in non-production', () => {
    const { host, json } = buildHost('/api/boom');
    filter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).toHaveProperty('stack');
  });

  it('omits stack in production', () => {
    const prodFilter = new GlobalExceptionFilter(mockConfig('production'));
    const { host, json } = buildHost('/api/boom');
    prodFilter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).not.toHaveProperty('stack');
  });
});
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
pnpm test -- --testPathPattern="exception.filter.spec"
```

Expected: FAIL — `Cannot find module './exception.filter'`

- [ ] **Step 3: Implement exception.filter.ts**

Create `src/common/filters/exception.filter.ts`:

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AppConfig } from '../config/config.schema';

function codeFromStatus(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return map[status] ?? 'HTTP_ERROR';
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService<AppConfig>) {
    this.isDev =
      this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (this.isDev) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    let status: number;
    let code: string;
    let message: string;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        code = codeFromStatus(status);
        message = body;
      } else {
        const bodyObj = body as Record<string, unknown>;
        code = (bodyObj.code as string) ?? codeFromStatus(status);
        message = (bodyObj.message as string) ?? exception.message;
      }
      stack = exception.stack;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = 'Internal server error';
      stack = exception instanceof Error ? exception.stack : undefined;
    }

    response.status(status).json({
      status,
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(this.isDev && stack !== undefined && { stack }),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
```

- [ ] **Step 4: Run the tests — expect them to pass**

```bash
pnpm test -- --testPathPattern="exception.filter.spec"
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/common/filters/exception.filter.ts src/common/filters/exception.filter.spec.ts
git commit -m "feat: add GlobalExceptionFilter replacing Http and All exception filters"
```

---

## Task 5: Wire Up + Clean Up

**Files:**
- Modify: `src/app.module.ts`
- Modify: `test/app.e2e-spec.ts`
- Delete: `src/common/filters/http-exception.filter.ts`
- Delete: `src/common/filters/http-exception.filter.spec.ts`
- Delete: `src/common/filters/all-exceptions.filter.ts`
- Delete: `src/common/filters/all-exceptions.filter.spec.ts`

- [ ] **Step 1: Update app.module.ts**

Replace the contents of `src/app.module.ts`:

```ts
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/config.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
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
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 2: Delete old filter files**

```bash
rm src/common/filters/http-exception.filter.ts \
   src/common/filters/http-exception.filter.spec.ts \
   src/common/filters/all-exceptions.filter.ts \
   src/common/filters/all-exceptions.filter.spec.ts
```

- [ ] **Step 3: Update the e2e test**

The response body is now a JSON envelope, not a plain string. Replace the contents of `test/app.e2e-spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET) returns the response envelope', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 200,
          success: true,
          data: 'Hello World!',
          error: null,
        });
        expect(res.body.timestamp).toBeDefined();
      });
  });
});
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All test suites pass. The old filter specs are gone; new `exception.filter.spec.ts` and `response.interceptor.spec.ts` pass.

- [ ] **Step 5: Run the e2e test**

```bash
pnpm test:e2e
```

Expected: PASS — 1 test.

- [ ] **Step 6: Type-check**

```bash
pnpm exec tsc --noEmit -p tsconfig.build.json
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/app.module.ts test/app.e2e-spec.ts
git rm src/common/filters/http-exception.filter.ts \
       src/common/filters/http-exception.filter.spec.ts \
       src/common/filters/all-exceptions.filter.ts \
       src/common/filters/all-exceptions.filter.spec.ts
git commit -m "feat: wire ResponseInterceptor + GlobalExceptionFilter, remove old filters"
```
