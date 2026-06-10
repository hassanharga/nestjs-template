import {
  bulkhead,
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  IPolicy,
  noop,
  retry,
  timeout,
  TimeoutStrategy,
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
    const cb = circuitBreaker(handleAll, {
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

  const timeoutCfg = resolve<TimeoutOptions>(options.timeout, defaults.timeout);
  if (timeoutCfg) {
    const t = timeout(
      timeoutCfg.ms ?? defaults.timeout.ms,
      TimeoutStrategy.Aggressive,
    );
    t.onTimeout(() => observer?.recordTimeout(name));
    policies.push(t);
  }

  const retryCfg = resolve<RetryOptions>(options.retry, defaults.retry);
  if (retryCfg) {
    const r = retry(handleAll, {
      maxAttempts: retryCfg.maxAttempts ?? defaults.retry.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: retryCfg.initialDelayMs ?? defaults.retry.initialDelayMs,
        maxDelay: retryCfg.maxDelayMs ?? defaults.retry.maxDelayMs,
      }),
    });
    r.onRetry(() => observer?.recordRetry(name));
    policies.push(r);
  }

  if (policies.length === 0) return noop;
  if (policies.length === 1) return policies[0];
  return wrap(...policies);
}
