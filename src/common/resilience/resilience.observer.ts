import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';
import { BreakerStateValue, RESILIENCE_METRICS } from './resilience.constants';
import { ResilienceObserverLike } from './resilience.types';

@Injectable()
export class ResilienceObserver implements ResilienceObserverLike {
  private readonly logger = new Logger('Resilience');

  constructor(
    @InjectMetric(RESILIENCE_METRICS.retries)
    private readonly retries: Counter<string>,
    @InjectMetric(RESILIENCE_METRICS.timeouts)
    private readonly timeouts: Counter<string>,
    @InjectMetric(RESILIENCE_METRICS.circuitBreakerEvents)
    private readonly breakerEvents: Counter<string>,
    @InjectMetric(RESILIENCE_METRICS.bulkheadRejections)
    private readonly bulkheadRejections: Counter<string>,
    @InjectMetric(RESILIENCE_METRICS.circuitBreakerState)
    private readonly breakerState: Gauge<string>,
  ) {}

  recordRetry(policy: string): void {
    this.retries.inc({ policy });
    this.logger.debug(`[${policy}] retrying call`);
  }

  recordTimeout(policy: string): void {
    this.timeouts.inc({ policy });
    this.logger.warn(`[${policy}] call timed out`);
  }

  recordBreakerOpen(policy: string): void {
    this.breakerEvents.inc({ policy, event: 'open' });
    this.breakerState.set({ policy }, BreakerStateValue.Open);
    this.logger.warn(`[${policy}] circuit opened`);
  }

  recordBreakerHalfOpen(policy: string): void {
    this.breakerEvents.inc({ policy, event: 'half_open' });
    this.breakerState.set({ policy }, BreakerStateValue.HalfOpen);
    this.logger.log(`[${policy}] circuit half-open`);
  }

  recordBreakerClose(policy: string): void {
    this.breakerEvents.inc({ policy, event: 'close' });
    this.breakerState.set({ policy }, BreakerStateValue.Closed);
    this.logger.log(`[${policy}] circuit closed`);
  }

  recordBulkheadRejection(policy: string): void {
    this.bulkheadRejections.inc({ policy });
    this.logger.warn(`[${policy}] bulkhead rejected call`);
  }
}
