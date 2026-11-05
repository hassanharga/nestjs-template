import { ObservedTimeoutPolicy } from './observed-timeout.policy';
import {
  bulkhead,
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleWhen,
  TaskCancelledError,
  IPolicy,
  noop,
  retry,
  wrap,
} from 'cockatiel';
import {
  BulkheadOptions,
  CircuitBreakerOptions,
  ResilienceDefaults,
  ResilienceObserverLike,
  ResilienceOptions,
  RetryOptions,
  TimeoutOptions,
} from './resilience.types';

/** Retry only transport failures and explicitly transient HTTP responses. */
export function isTransientError(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < 8; depth++) {
    if (current instanceof TaskCancelledError) return true;
    if (!current || typeof current !== 'object' || seen.has(current))
      return false;
    seen.add(current);
    const value = current as {
      code?: string;
      status?: number;
      statusCode?: number;
      name?: string;
      cause?: unknown;
    };
    if (value.name === 'AbortError') return false;
    const status = value.status ?? value.statusCode;
    if (status !== undefined) return [408, 429, 502, 503, 504].includes(status);
    if (
      ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(
        value.code ?? '',
      )
    )
      return true;
    current = value.cause;
  }
  return false;
}

function resolve<T extends object>(
  value: boolean | T | undefined,
  defaults: T,
): T | null {
  if (value === undefined || value === false) return null;
  if (value === true) return defaults;
  return { ...defaults, ...value };
}

export function buildPolicy(
  options: ResilienceOptions,
  defaults: ResilienceDefaults,
  observer?: ResilienceObserverLike,
): IPolicy {
  const name = options.name ?? 'unknown';
  const policies: IPolicy[] = [];
  if (options.totalTimeout?.ms !== undefined) {
    policies.push(
      new ObservedTimeoutPolicy(options.totalTimeout.ms, () =>
        observer?.recordTimeout(name, 'total'),
      ),
    );
  }

  const bulkheadCfg = resolve<BulkheadOptions>(
    options.bulkhead,
    defaults.bulkhead,
  );
  if (bulkheadCfg) {
    const b = bulkhead(
      bulkheadCfg.maxConcurrent ?? defaults.bulkhead.maxConcurrent,
      bulkheadCfg.maxQueue ?? defaults.bulkhead.maxQueue,
    );
    b.onReject(() => observer?.recordBulkheadRejection(name));
    policies.push(b);
  }

  const breakerCfg = resolve<CircuitBreakerOptions>(
    options.circuitBreaker,
    defaults.circuitBreaker,
  );
  if (breakerCfg) {
    const cb = circuitBreaker(handleWhen(isTransientError), {
      halfOpenAfter:
        breakerCfg.halfOpenAfterMs ?? defaults.circuitBreaker.halfOpenAfterMs,
      breaker: new ConsecutiveBreaker(
        breakerCfg.threshold ?? defaults.circuitBreaker.threshold,
      ),
    });
    cb.onBreak(() => observer?.recordBreakerOpen(name));
    cb.onHalfOpen(() => observer?.recordBreakerHalfOpen(name));
    cb.onReset(() => observer?.recordBreakerClose(name));
    policies.push(cb);
  }

  const retryCfg = resolve<RetryOptions>(options.retry, defaults.retry);
  if (retryCfg) {
    const r = retry(handleWhen(isTransientError), {
      maxAttempts: retryCfg.maxAttempts ?? defaults.retry.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: retryCfg.initialDelayMs ?? defaults.retry.initialDelayMs,
        maxDelay: retryCfg.maxDelayMs ?? defaults.retry.maxDelayMs,
      }),
    });
    r.onRetry(() => observer?.recordRetry(name));
    policies.push(r);
  }

  const timeoutCfg = resolve<TimeoutOptions>(options.timeout, defaults.timeout);
  if (timeoutCfg) {
    const t = new ObservedTimeoutPolicy(
      timeoutCfg.ms ?? defaults.timeout.ms,
      () => observer?.recordTimeout(name),
    );
    policies.push(t);
  }

  if (policies.length === 0) return noop;
  if (policies.length === 1) return policies[0];
  return wrap(...policies);
}
