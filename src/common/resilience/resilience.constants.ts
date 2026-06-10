export const RESILIENCE_METRICS = {
  retries: 'resilience_retries_total',
  timeouts: 'resilience_timeouts_total',
  circuitBreakerEvents: 'resilience_circuit_breaker_events_total',
  bulkheadRejections: 'resilience_bulkhead_rejections_total',
  circuitBreakerState: 'resilience_circuit_breaker_state',
} as const;

export enum BreakerStateValue {
  Closed = 0,
  HalfOpen = 1,
  Open = 2,
}
