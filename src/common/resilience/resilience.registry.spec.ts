import { ResilienceRegistry, FALLBACK_DEFAULTS } from './resilience.registry';

it('isolates application defaults', () => {
  const a = new ResilienceRegistry({
    ...FALLBACK_DEFAULTS,
    timeout: { ms: 123 },
  });
  const b = new ResilienceRegistry();
  expect(a.defaults.timeout.ms).toBe(123);
  expect(b.defaults.timeout.ms).toBe(5000);
});
