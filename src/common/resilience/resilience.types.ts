export interface RetryOptions {
  /** Additional retries; maxAttempts=3 permits up to four executions. */
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export interface TimeoutOptions {
  ms?: number;
}

export interface CircuitBreakerOptions {
  threshold?: number;
  halfOpenAfterMs?: number;
}

export interface BulkheadOptions {
  maxConcurrent?: number;
  maxQueue?: number;
}

export interface ResilienceOptions {
  name?: string;
  retry?: boolean | RetryOptions;
  /** Timeout for one attempt. Operations must honor context.signal. */
  timeout?: boolean | TimeoutOptions;
  /** Optional overall budget, including retry backoff. */
  totalTimeout?: TimeoutOptions;
  circuitBreaker?: boolean | CircuitBreakerOptions;
  bulkhead?: boolean | BulkheadOptions;
}

export interface ResilienceDefaults {
  retry: { maxAttempts: number; initialDelayMs: number; maxDelayMs: number };
  timeout: { ms: number };
  circuitBreaker: { threshold: number; halfOpenAfterMs: number };
  bulkhead: { maxConcurrent: number; maxQueue: number };
}

export interface ResilienceObserverLike {
  recordRetry(policy: string): void;
  recordTimeout(policy: string, kind?: 'attempt' | 'total'): void;
  recordBreakerOpen(policy: string): void;
  recordBreakerHalfOpen(policy: string): void;
  recordBreakerClose(policy: string): void;
  recordBulkheadRejection(policy: string): void;
}
