import { createServer } from 'node:net';
import { buildPolicy, isTransientError } from './resilience.factory';
import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';
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
  expect(isTransientError({ status: 400, cause: { code: 'ECONNRESET' } })).toBe(
    false,
  );
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
  if (!address || typeof address === 'string') throw new Error('Missing port');
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
