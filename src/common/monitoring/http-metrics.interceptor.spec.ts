import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { of } from 'rxjs';

describe('HttpMetricsInterceptor', () => {
  it('increments the request counter and records duration on successful response', (done) => {
    const endTimer = jest.fn();
    const counter = { inc: jest.fn() };
    const histogram = { startTimer: jest.fn().mockReturnValue(endTimer) };

    const interceptor = new HttpMetricsInterceptor(
      counter as any,
      histogram as any,
    );

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
        expect(histogram.startTimer).toHaveBeenCalledWith({
          method: 'GET',
          path: '/test',
        });
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

  it('skips metrics recording for /metrics path', (done) => {
    const counter = { inc: jest.fn() };
    const histogram = { startTimer: jest.fn() };
    const interceptor = new HttpMetricsInterceptor(
      counter as any,
      histogram as any,
    );

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', path: '/metrics' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as any;
    const handler = { handle: () => of('result') };

    interceptor.intercept(context, handler).subscribe({
      complete: () => {
        expect(histogram.startTimer).not.toHaveBeenCalled();
        expect(counter.inc).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
