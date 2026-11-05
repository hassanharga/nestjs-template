import { scopedCounterProvider, scopedGaugeProvider } from './metric.providers';
import { RESILIENCE_METRICS } from '../resilience/resilience.constants';

/** Registered only by the optional monitoring module. */
export const resilienceMetricProviders = [
  scopedCounterProvider({
    name: RESILIENCE_METRICS.retries,
    help: 'Total number of resilience retry attempts',
    labelNames: ['policy'],
  }),
  scopedCounterProvider({
    name: RESILIENCE_METRICS.timeouts,
    help: 'Total number of resilience timeouts by budget kind',
    labelNames: ['policy', 'kind'],
  }),
  scopedCounterProvider({
    name: RESILIENCE_METRICS.circuitBreakerEvents,
    help: 'Total number of circuit breaker state-change events',
    labelNames: ['policy', 'event'],
  }),
  scopedCounterProvider({
    name: RESILIENCE_METRICS.bulkheadRejections,
    help: 'Total number of bulkhead rejections',
    labelNames: ['policy'],
  }),
  scopedGaugeProvider({
    name: RESILIENCE_METRICS.circuitBreakerState,
    help: 'Circuit breaker state (0 closed, 1 half-open, 2 open)',
    labelNames: ['policy'],
  }),
];
