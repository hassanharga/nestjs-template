import { Test } from '@nestjs/testing';
import { MetricsRegistry } from './metrics.registry';
import { MonitoringModule } from './monitoring.module';
import { ResilienceObserver } from '../resilience/resilience.observer';
import { RESILIENCE_METRICS } from '../resilience/resilience.constants';

it('exports working resilience metrics to an importing observer', async () => {
  const module = await Test.createTestingModule({
    imports: [MonitoringModule],
    providers: [ResilienceObserver],
  }).compile();
  try {
    const observer = module.get<ResilienceObserver>(ResilienceObserver);
    observer.recordRetry('integration.metrics');
    observer.recordTimeout('integration.metrics');
    observer.recordTimeout('integration.metrics', 'total');
    const timeouts = await module
      .get<MetricsRegistry>(MetricsRegistry)
      .getSingleMetric(RESILIENCE_METRICS.timeouts)!
      .get();
    expect(timeouts.values.map(({ labels }) => labels.kind).sort()).toEqual([
      'attempt',
      'total',
    ]);
    observer.recordBulkheadRejection('integration.metrics');
    observer.recordBreakerOpen('integration.metrics');
    for (const name of Object.values(RESILIENCE_METRICS)) {
      const metric = module
        .get<MetricsRegistry>(MetricsRegistry)
        .getSingleMetric(name);
      expect(metric).toBeDefined();
      const snapshot = await metric!.get();
      expect(
        snapshot.values.some(
          ({ labels }) => labels.policy === 'integration.metrics',
        ),
      ).toBe(true);
    }
  } finally {
    await module.close();
  }
});

it('constructs a logger-only observer without monitoring providers', async () => {
  const module = await Test.createTestingModule({
    providers: [ResilienceObserver],
  }).compile();
  try {
    const observer = module.get<ResilienceObserver>(ResilienceObserver);
    expect(() => {
      observer.recordRetry('logger-only');
      observer.recordTimeout('logger-only');
      observer.recordBulkheadRejection('logger-only');
      observer.recordBreakerOpen('logger-only');
      observer.recordBreakerHalfOpen('logger-only');
      observer.recordBreakerClose('logger-only');
    }).not.toThrow();
  } finally {
    await module.close();
  }
});
