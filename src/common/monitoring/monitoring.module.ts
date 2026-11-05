import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import {
  scopedCounterProvider,
  scopedHistogramProvider,
} from './metric.providers';
import { MetricsRegistry } from './metrics.registry';
import { resilienceMetricProviders } from './resilience.metrics';
import { MetricsController } from './metrics.controller';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

@Module({
  controllers: [MetricsController],
  exports: [...resilienceMetricProviders, MetricsRegistry],
  providers: [
    MetricsRegistry,
    ...resilienceMetricProviders,
    scopedCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
    }),
    scopedHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    HttpMetricsMiddleware,
  ],
})
export class MonitoringModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(HttpMetricsMiddleware).forRoutes('{*path}');
  }
}
