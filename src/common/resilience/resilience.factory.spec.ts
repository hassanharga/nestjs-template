import { buildPolicy } from './resilience.factory';
import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';

const defaults: ResilienceDefaults = {
  retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2 },
  timeout: { ms: 50 },
  circuitBreaker: { threshold: 2, halfOpenAfterMs: 10000 },
  bulkhead: { maxConcurrent: 1, maxQueue: 0 },
};

function fakeObserver(): jest.Mocked<ResilienceObserverLike> {
  return {
    recordRetry: jest.fn(),
    recordTimeout: jest.fn(),
    recordBreakerOpen: jest.fn(),
    recordBreakerHalfOpen: jest.fn(),
    recordBreakerClose: jest.fn(),
    recordBulkheadRejection: jest.fn(),
  };
}

describe('buildPolicy', () => {
  it('executes the function directly when no patterns are enabled', async () => {
    const policy = buildPolicy({ name: 'p' }, defaults);
    await expect(policy.execute(() => Promise.resolve(42))).resolves.toBe(42);
  });

  it('retries on failure and reports to the observer', async () => {
    const observer = fakeObserver();
    const policy = buildPolicy({ name: 'p', retry: true }, defaults, observer);
    let calls = 0;
    const result = await policy.execute(() => {
      calls += 1;
      if (calls < 2) throw new Error('boom');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(observer.recordRetry).toHaveBeenCalledWith('p');
  });

  it('times out a slow call and reports to the observer', async () => {
    const observer = fakeObserver();
    const policy = buildPolicy(
      { name: 'p', timeout: { ms: 20 } },
      defaults,
      observer,
    );
    await expect(
      policy.execute(() => new Promise((r) => setTimeout(r, 100))),
    ).rejects.toBeDefined();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(observer.recordTimeout).toHaveBeenCalledWith('p');
  });

  it('opens the circuit after consecutive failures and reports to the observer', async () => {
    const observer = fakeObserver();
    const policy = buildPolicy(
      { name: 'p', circuitBreaker: { threshold: 2 } },
      defaults,
      observer,
    );
    const fail = () => policy.execute(() => Promise.reject(new Error('x')));
    await expect(fail()).rejects.toBeDefined();
    await expect(fail()).rejects.toBeDefined();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(observer.recordBreakerOpen).toHaveBeenCalledWith('p');
  });

  it('rejects past the bulkhead limit and reports to the observer', async () => {
    const observer = fakeObserver();
    const policy = buildPolicy(
      { name: 'p', bulkhead: { maxConcurrent: 1, maxQueue: 0 } },
      defaults,
      observer,
    );
    const slow = () =>
      policy.execute(() => new Promise((r) => setTimeout(() => r('done'), 30)));
    const first = slow();
    const second = slow();
    await expect(second).rejects.toBeDefined();
    await expect(first).resolves.toBe('done');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(observer.recordBulkheadRejection).toHaveBeenCalledWith('p');
  });
});
