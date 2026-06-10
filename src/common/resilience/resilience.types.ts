export interface RetryOptions {
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
  timeout?: boolean | TimeoutOptions;
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
  recordTimeout(policy: string): void;
  recordBreakerOpen(policy: string): void;
  recordBreakerHalfOpen(policy: string): void;
  recordBreakerClose(policy: string): void;
  recordBulkheadRejection(policy: string): void;
}
