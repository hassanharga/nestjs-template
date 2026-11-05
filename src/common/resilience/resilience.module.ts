import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigService } from '@nestjs/config';
import { configSchema } from '../config/config.schema';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ResilienceObserver } from './resilience.observer';
import { ResilienceRegistry, FALLBACK_DEFAULTS } from './resilience.registry';

@Module({
  imports: [
    ConditionalModule.registerWhen(
      MonitoringModule,
      (env) => configSchema.parse(env).FEATURE_MONITORING,
      { debug: false },
    ),
  ],
  providers: [
    ResilienceObserver,
    {
      provide: ResilienceRegistry,
      inject: [ConfigService, ResilienceObserver],
      useFactory: (config: ConfigService, observer: ResilienceObserver) =>
        new ResilienceRegistry(
          {
            retry: {
              maxAttempts: config.get<number>(
                'RESILIENCE_RETRY_MAX_ATTEMPTS',
                FALLBACK_DEFAULTS.retry.maxAttempts,
              ),
              initialDelayMs: config.get<number>(
                'RESILIENCE_RETRY_INITIAL_DELAY_MS',
                FALLBACK_DEFAULTS.retry.initialDelayMs,
              ),
              maxDelayMs: config.get<number>(
                'RESILIENCE_RETRY_MAX_DELAY_MS',
                FALLBACK_DEFAULTS.retry.maxDelayMs,
              ),
            },
            timeout: {
              ms: config.get<number>(
                'RESILIENCE_TIMEOUT_MS',
                FALLBACK_DEFAULTS.timeout.ms,
              ),
            },
            circuitBreaker: {
              threshold: config.get<number>(
                'RESILIENCE_CIRCUIT_BREAKER_THRESHOLD',
                FALLBACK_DEFAULTS.circuitBreaker.threshold,
              ),
              halfOpenAfterMs: config.get<number>(
                'RESILIENCE_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS',
                FALLBACK_DEFAULTS.circuitBreaker.halfOpenAfterMs,
              ),
            },
            bulkhead: {
              maxConcurrent: config.get<number>(
                'RESILIENCE_BULKHEAD_MAX_CONCURRENT',
                FALLBACK_DEFAULTS.bulkhead.maxConcurrent,
              ),
              maxQueue: config.get<number>(
                'RESILIENCE_BULKHEAD_MAX_QUEUE',
                FALLBACK_DEFAULTS.bulkhead.maxQueue,
              ),
            },
          },
          observer,
        ),
    },
  ],
  exports: [ResilienceRegistry],
})
export class ResilienceModule {}
