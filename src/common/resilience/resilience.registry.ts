import { IPolicy } from 'cockatiel';
import { buildPolicy } from './resilience.factory';
import { ResilienceOptions } from './resilience.types';
import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';

export const FALLBACK_DEFAULTS: ResilienceDefaults = {
  retry: { maxAttempts: 3, initialDelayMs: 128, maxDelayMs: 30000 },
  timeout: { ms: 5000 },
  circuitBreaker: { threshold: 5, halfOpenAfterMs: 10000 },
  bulkhead: { maxConcurrent: 10, maxQueue: 0 },
};

export class ResilienceRegistry {
  constructor(
    readonly defaults: ResilienceDefaults = FALLBACK_DEFAULTS,
    readonly observer?: ResilienceObserverLike,
  ) {}

  create(options: ResilienceOptions): IPolicy {
    return buildPolicy(options, this.defaults, this.observer);
  }
}
