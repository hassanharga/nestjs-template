/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { err, ok } from 'neverthrow';
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
