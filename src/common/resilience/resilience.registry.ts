import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';

export const FALLBACK_DEFAULTS: ResilienceDefaults = {
  retry: { maxAttempts: 3, initialDelayMs: 128, maxDelayMs: 30000 },
  timeout: { ms: 5000 },
  circuitBreaker: { threshold: 5, halfOpenAfterMs: 10000 },
  bulkhead: { maxConcurrent: 10, maxQueue: 0 },
};

export class ResilienceRegistry {
  private static defaults: ResilienceDefaults | undefined;
  private static observer: ResilienceObserverLike | undefined;

  static configure(
    defaults: ResilienceDefaults,
    observer: ResilienceObserverLike,
  ): void {
    this.defaults = defaults;
    this.observer = observer;
  }

  static getDefaults(): ResilienceDefaults {
    return this.defaults ?? FALLBACK_DEFAULTS;
  }

  static getObserver(): ResilienceObserverLike | undefined {
    return this.observer;
  }

  static reset(): void {
    this.defaults = undefined;
    this.observer = undefined;
  }
}
