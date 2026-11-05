import { FactoryProvider } from '@nestjs/common';
import { getToken } from '@willsoto/nestjs-prometheus';
import {
  Counter,
  CounterConfiguration,
  Gauge,
  GaugeConfiguration,
  Histogram,
  HistogramConfiguration,
} from 'prom-client';
import { MetricsRegistry } from './metrics.registry';

export const scopedCounterProvider = (
  options: Omit<CounterConfiguration<string>, 'registers'>,
): FactoryProvider<Counter<string>> => ({
  provide: getToken(options.name),
  inject: [MetricsRegistry],
  useFactory: (registry: MetricsRegistry) =>
    new Counter({ ...options, registers: [registry] }),
});

export const scopedGaugeProvider = (
  options: Omit<GaugeConfiguration<string>, 'registers'>,
): FactoryProvider<Gauge<string>> => ({
  provide: getToken(options.name),
  inject: [MetricsRegistry],
  useFactory: (registry: MetricsRegistry) =>
    new Gauge({ ...options, registers: [registry] }),
});

export const scopedHistogramProvider = (
  options: Omit<HistogramConfiguration<string>, 'registers'>,
): FactoryProvider<Histogram<string>> => ({
  provide: getToken(options.name),
  inject: [MetricsRegistry],
  useFactory: (registry: MetricsRegistry) =>
    new Histogram({ ...options, registers: [registry] }),
});
