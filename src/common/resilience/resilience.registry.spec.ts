import { ResilienceRegistry, FALLBACK_DEFAULTS } from './resilience.registry';
import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';

describe('ResilienceRegistry', () => {
  afterEach(() => ResilienceRegistry.reset());

  it('returns fallback defaults before configuration', () => {
    expect(ResilienceRegistry.getDefaults()).toEqual(FALLBACK_DEFAULTS);
    expect(ResilienceRegistry.getObserver()).toBeUndefined();
  });

  it('returns configured defaults and observer after configure', () => {
    const defaults: ResilienceDefaults = {
      retry: { maxAttempts: 9, initialDelayMs: 1, maxDelayMs: 2 },
      timeout: { ms: 123 },
      circuitBreaker: { threshold: 4, halfOpenAfterMs: 5 },
      bulkhead: { maxConcurrent: 6, maxQueue: 7 },
    };
    const observer = {} as ResilienceObserverLike;
    ResilienceRegistry.configure(defaults, observer);
    expect(ResilienceRegistry.getDefaults()).toBe(defaults);
    expect(ResilienceRegistry.getObserver()).toBe(observer);
  });
});
