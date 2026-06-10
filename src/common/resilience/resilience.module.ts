import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  makeCounterProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { RESILIENCE_METRICS } from './resilience.constants';
import { ResilienceObserver } from './resilience.observer';
import { ResilienceRegistry } from './resilience.registry';
import { ResilienceDefaults } from './resilience.types';

@Global()
@Module({
  providers: [
    makeCounterProvider({
      name: RESILIENCE_METRICS.retries,
      help: 'Total number of resilience retry attempts',
      labelNames: ['policy'],
    }),
    makeCounterProvider({
      name: RESILIENCE_METRICS.timeouts,
      help: 'Total number of resilience timeouts',
      labelNames: ['policy'],
    }),
    makeCounterProvider({
      name: RESILIENCE_METRICS.circuitBreakerEvents,
      help: 'Total number of circuit breaker state-change events',
      labelNames: ['policy', 'event'],
    }),
    makeCounterProvider({
      name: RESILIENCE_METRICS.bulkheadRejections,
      help: 'Total number of bulkhead rejections',
      labelNames: ['policy'],
    }),
    makeGaugeProvider({
      name: RESILIENCE_METRICS.circuitBreakerState,
      help: 'Circuit breaker state (0 closed, 1 half-open, 2 open)',
      labelNames: ['policy'],
    }),
    ResilienceObserver,
  ],
  exports: [ResilienceObserver],
})
export class ResilienceModule implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly observer: ResilienceObserver,
  ) {}

  onModuleInit(): void {
    const defaults: ResilienceDefaults = {
      retry: {
        maxAttempts: this.config.get<number>(
          'RESILIENCE_RETRY_MAX_ATTEMPTS',
          3,
        ),
        initialDelayMs: this.config.get<number>(
          'RESILIENCE_RETRY_INITIAL_DELAY_MS',
          128,
        ),
        maxDelayMs: this.config.get<number>(
          'RESILIENCE_RETRY_MAX_DELAY_MS',
          30000,
        ),
      },
      timeout: {
        ms: this.config.get<number>('RESILIENCE_TIMEOUT_MS', 5000),
      },
      circuitBreaker: {
        threshold: this.config.get<number>(
          'RESILIENCE_CIRCUIT_BREAKER_THRESHOLD',
          5,
        ),
        halfOpenAfterMs: this.config.get<number>(
          'RESILIENCE_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS',
          10000,
        ),
      },
      bulkhead: {
        maxConcurrent: this.config.get<number>(
          'RESILIENCE_BULKHEAD_MAX_CONCURRENT',
          10,
        ),
        maxQueue: this.config.get<number>('RESILIENCE_BULKHEAD_MAX_QUEUE', 0),
      },
    };
    ResilienceRegistry.configure(defaults, this.observer);
  }
}
