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
