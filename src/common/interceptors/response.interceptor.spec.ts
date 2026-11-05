import {
  CallHandler,
  ExecutionContext,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { err, ok } from 'neverthrow';
import { Readable } from 'node:stream';
import { firstValueFrom, of } from 'rxjs';
import { RAW_RESPONSE } from './raw-response.decorator';
import { ResponseInterceptor } from './response.interceptor';

function buildContext(path: string, statusCode = 200, headersSent = false) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path }),
      getResponse: () => ({ statusCode, headersSent }),
    }),
  } as unknown as ExecutionContext;
}

function buildHandler(returnValue: unknown) {
  return { handle: () => of(returnValue) } satisfies CallHandler<unknown>;
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
        expect((result as { timestamp: string }).timestamp).toBeDefined();
        done();
      });
  });

  it('leaves 204 responses unwrapped', (done) => {
    interceptor
      .intercept(buildContext('/api/users', 204), buildHandler(null))
      .subscribe((result) => {
        expect(result).toBeNull();
        done();
      });
  });

  it('maps undefined data to null in the envelope', (done) => {
    interceptor
      .intercept(buildContext('/api/users', 200), buildHandler(undefined))
      .subscribe((result) => {
        expect((result as { data: unknown }).data).toBeNull();
        done();
      });
  });

  it('passes through /metrics without wrapping', (done) => {
    interceptor
      .intercept(
        buildContext('/metrics', 200),
        buildHandler('raw-metrics-data'),
      )
      .subscribe((result) => {
        expect(result).toBe('raw-metrics-data');
        done();
      });
  });

  it('passes through /health/* without wrapping', (done) => {
    interceptor
      .intercept(
        buildContext('/health/live', 200),
        buildHandler({ status: 'ok' }),
      )
      .subscribe((result) => {
        expect(result).toEqual({ status: 'ok' });
        done();
      });
  });

  it('unwraps ok Result into the data envelope', (done) => {
    interceptor
      .intercept(buildContext('/api/items', 200), buildHandler(ok({ id: 1 })))
      .subscribe((result) => {
        expect(result).toMatchObject({
          success: true,
          data: { id: 1 },
        });
        done();
      });
  });

  it('throws when Result is an err', (done) => {
    const error = new NotFoundException('not found');
    interceptor
      .intercept(buildContext('/api/items', 200), buildHandler(err(error)))
      .subscribe({
        error: (thrown) => {
          expect(thrown).toBe(error);
          done();
        },
      });
  });
});

it('passes through download streams', (done) => {
  const stream = new StreamableFile(Buffer.from('download'));
  new ResponseInterceptor()
    .intercept(buildContext('/download'), buildHandler(stream))
    .subscribe((value) => {
      expect(value).toBe(stream);
      done();
    });
});

it('supports an explicit opt-out response contract', (done) => {
  const handler = () => undefined;
  Reflect.defineMetadata(RAW_RESPONSE, true, handler);
  const context = Object.assign(buildContext('/raw'), {
    getHandler: () => handler,
    getClass: () => class Controller {},
  });
  new ResponseInterceptor()
    .intercept(context, buildHandler('raw'))
    .subscribe((value) => {
      expect(value).toBe('raw');
      done();
    });
});

it('passes already-sent, readable and binary responses through unchanged', async () => {
  const interceptor = new ResponseInterceptor();
  const sent = { sent: true };
  expect(
    await firstValueFrom(
      interceptor.intercept(
        buildContext('/raw', 200, true),
        buildHandler(sent),
      ),
    ),
  ).toBe(sent);
  for (const value of [
    new Readable({
      read() {
        this.push(null);
      },
    }),
    Buffer.from('csv'),
  ]) {
    expect(
      await firstValueFrom(
        interceptor.intercept(buildContext('/raw'), buildHandler(value)),
      ),
    ).toBe(value);
  }
});
