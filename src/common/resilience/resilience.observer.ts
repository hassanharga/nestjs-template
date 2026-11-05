import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';
import { BreakerStateValue, RESILIENCE_METRICS } from './resilience.constants';
import { ResilienceObserverLike } from './resilience.types';

@Injectable()
export class ResilienceObserver implements ResilienceObserverLike {
  private readonly logger = new Logger('Resilience');

  constructor(
    @Optional()
    @InjectMetric(RESILIENCE_METRICS.retries)
    private readonly retries: Counter<string>,
    @Optional()
    @InjectMetric(RESILIENCE_METRICS.timeouts)
    private readonly timeouts: Counter<string>,
    @Optional()
    @InjectMetric(RESILIENCE_METRICS.circuitBreakerEvents)
    private readonly breakerEvents: Counter<string>,
    @Optional()
    @InjectMetric(RESILIENCE_METRICS.bulkheadRejections)
    private readonly bulkheadRejections: Counter<string>,
    @Optional()
    @InjectMetric(RESILIENCE_METRICS.circuitBreakerState)
    private readonly breakerState: Gauge<string>,
  ) {}

  recordRetry(policy: string): void {
    this.retries?.inc({ policy });
    this.logger.debug({ event: 'resilience.retry', policy });
  }

  recordTimeout(policy: string, kind: 'attempt' | 'total' = 'attempt'): void {
    this.timeouts?.inc({ policy, kind });
    this.logger.warn({ event: 'resilience.timeout', policy, kind });
  }

  recordBreakerOpen(policy: string): void {
    this.breakerEvents?.inc({ policy, event: 'open' });
    this.breakerState?.set({ policy }, BreakerStateValue.Open);
    this.logger.warn({ event: 'resilience.circuit.open', policy });
  }

  recordBreakerHalfOpen(policy: string): void {
    this.breakerEvents?.inc({ policy, event: 'half_open' });
    this.breakerState?.set({ policy }, BreakerStateValue.HalfOpen);
    this.logger.log({ event: 'resilience.circuit.half_open', policy });
  }

  recordBreakerClose(policy: string): void {
    this.breakerEvents?.inc({ policy, event: 'close' });
    this.breakerState?.set({ policy }, BreakerStateValue.Closed);
    this.logger.log({ event: 'resilience.circuit.closed', policy });
  }

  recordBulkheadRejection(policy: string): void {
    this.bulkheadRejections?.inc({ policy });
    this.logger.warn({ event: 'resilience.bulkhead.rejected', policy });
  }
}
