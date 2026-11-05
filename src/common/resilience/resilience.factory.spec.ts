import { createServer } from 'node:net';
import { buildPolicy, isTransientError } from './resilience.factory';
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
      if (calls < 2)
        throw Object.assign(new Error('boom'), { code: 'ECONNRESET' });
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
    const fail = () =>
      policy.execute(() =>
        Promise.reject(Object.assign(new Error('x'), { code: 'ECONNRESET' })),
      );
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

it('does not retry permanent failures', async () => {
  const policy = buildPolicy({ retry: true }, defaults);
  const call = jest.fn(() => {
    throw new TypeError('programming error');
  });
  await expect(policy.execute(call)).rejects.toBeInstanceOf(TypeError);
  expect(call).toHaveBeenCalledTimes(1);
});

it('gives each retry its own timeout and forwards cancellation', async () => {
  const policy = buildPolicy(
    { retry: { maxAttempts: 1, initialDelayMs: 1 }, timeout: { ms: 10 } },
    defaults,
  );
  const signals: AbortSignal[] = [];
  await expect(
    policy.execute(({ signal }) => {
      signals.push(signal);
      return new Promise(() => undefined);
    }),
  ).rejects.toBeDefined();
  expect(signals).toHaveLength(2);
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});

it('propagates caller cancellation without retrying the cancelled call', async () => {
  const aborter = new AbortController();
  const policy = buildPolicy({ retry: true, timeout: { ms: 1000 } }, defaults);
  let supplied: AbortSignal | undefined;
  const call = jest.fn(({ signal }: { signal: AbortSignal }) => {
    supplied = signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener(
        'abort',
        () =>
          reject(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
        { once: true },
      ),
    );
  });
  const result = policy.execute(call, aborter.signal);
  aborter.abort();
  await expect(result).rejects.toBeDefined();
  expect(supplied?.aborted).toBe(true);
  expect(call).toHaveBeenCalledTimes(1);
});

describe('transport classification and timeout budgets', () => {
  const defaults: ResilienceDefaults = {
    retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 1 },
    timeout: { ms: 20 },
    circuitBreaker: { threshold: 1, halfOpenAfterMs: 10000 },
    bulkhead: { maxConcurrent: 2, maxQueue: 0 },
  };
  function observer() {
    return {
      recordRetry: jest.fn(),
      recordTimeout: jest.fn(),
      recordBreakerOpen: jest.fn(),
      recordBreakerClose: jest.fn(),
      recordBreakerHalfOpen: jest.fn(),
      recordBulkheadRejection: jest.fn(),
    } satisfies ResilienceObserverLike;
  }
  it('classifies bounded nested causes, explicit statuses and cancellation', () => {
    expect(
      isTransientError(
        new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }),
      ),
    ).toBe(true);
    for (const status of [408, 429, 502, 503, 504])
      expect(isTransientError({ status })).toBe(true);
    expect(
      isTransientError({ status: 400, cause: { code: 'ECONNRESET' } }),
    ).toBe(false);
    expect(isTransientError({ status: 500, statusCode: 502 })).toBe(false);
    expect(
      isTransientError({ name: 'AbortError', cause: { code: 'ECONNRESET' } }),
    ).toBe(false);
    const cycle: { cause?: unknown } = {};
    cycle.cause = cycle;
    expect(isTransientError(cycle)).toBe(false);
  });
  it('retries real refused fetches and opens a circuit on wrapped transport errors', async () => {
    const socket = createServer();
    await new Promise<void>((resolve, reject) =>
      socket.once('error', reject).listen(0, '127.0.0.1', resolve),
    );
    const address = socket.address();
    if (!address || typeof address === 'string')
      throw new Error('Missing port');
    await new Promise<void>((resolve, reject) =>
      socket.close((error) => (error ? reject(error) : resolve())),
    );
    const seen = observer();
    let calls = 0;
    const policy = buildPolicy(
      { name: 'refused', retry: true, circuitBreaker: true },
      defaults,
      seen,
    );
    await expect(
      policy.execute(() => {
        calls++;
        return fetch(`http://127.0.0.1:${address.port}/`);
      }),
    ).rejects.toThrow();
    expect(calls).toBe(2);
    expect(seen.recordRetry).toHaveBeenCalledWith('refused');
    expect(seen.recordBreakerOpen).toHaveBeenCalledWith('refused');
  });
  it('separates caller cancellation, total budget and per-attempt timeout under concurrency', async () => {
    const seen = observer();
    const aborter = new AbortController();
    const policy = buildPolicy(
      { name: 'p', timeout: { ms: 20 } },
      defaults,
      seen,
    );
    const cancelled = policy.execute(
      () => new Promise(() => undefined),
      aborter.signal,
    );
    const timed = policy.execute(() => new Promise(() => undefined));
    aborter.abort();
    await expect(cancelled).rejects.toBeDefined();
    await expect(timed).rejects.toBeDefined();
    expect(seen.recordTimeout).toHaveBeenCalledTimes(1);
    const totalSeen = observer();
    await expect(
      buildPolicy(
        {
          name: 'budget',
          totalTimeout: { ms: 10 },
          timeout: { ms: 500 },
          retry: true,
        },
        defaults,
        totalSeen,
      ).execute(() => new Promise(() => undefined)),
    ).rejects.toBeDefined();
    expect(totalSeen.recordTimeout).toHaveBeenCalledTimes(1);
    expect(totalSeen.recordTimeout).toHaveBeenCalledWith('budget', 'total');
    const only = observer();
    await expect(
      buildPolicy(
        { name: 'only', totalTimeout: { ms: 10 } },
        defaults,
        only,
      ).execute(() => new Promise(() => undefined)),
    ).rejects.toBeDefined();
    expect(only.recordTimeout).toHaveBeenCalledWith('only', 'total');
  });

  it.each([
    [503, undefined, 2],
    [400, undefined, 1],
    [500, 502, 1],
  ])(
    'retries according to HTTP status precedence %s/%s',
    async (status, statusCode, count) => {
      const call = jest.fn(() =>
        Promise.reject(
          Object.assign(new Error('upstream'), { status, statusCode }),
        ),
      );
      await expect(
        buildPolicy({ retry: true }, defaults).execute(call),
      ).rejects.toMatchObject({ status });
      expect(call).toHaveBeenCalledTimes(count);
    },
  );
  it('preserves additional-retry semantics and timeout success/failure events', async () => {
    const call = jest.fn(() =>
      Promise.reject(Object.assign(new Error('upstream'), { status: 503 })),
    );
    await expect(
      buildPolicy({ retry: { maxAttempts: 3 } }, defaults).execute(call),
    ).rejects.toBeDefined();
    expect(call).toHaveBeenCalledTimes(4);
    const seen = observer();
    const policy = buildPolicy(
      { name: 'events', timeout: { ms: 30 } },
      defaults,
      seen,
    );
    const success = jest.fn();
    const failure = jest.fn();
    const subscription = policy.onSuccess(success);
    policy.onFailure(failure);
    await expect(policy.execute(() => 42)).resolves.toBe(42);
    await expect(
      policy.execute(() => Promise.reject(new Error('failure'))),
    ).rejects.toThrow('failure');
    expect(success).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledTimes(1);
    expect(seen.recordTimeout).not.toHaveBeenCalled();
    subscription.dispose();
  });
});
