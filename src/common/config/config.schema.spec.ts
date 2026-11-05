import { configSchema } from './config.schema';

describe('configSchema', () => {
  it('applies defaults for all optional vars', () => {
    const result = configSchema.parse({});
    expect(result.PORT).toBe(3000);
    expect(result.LOG_LEVEL).toBe('info');
    expect(result.NODE_ENV).toBe('development');
    expect(result.CORS_ORIGINS).toBe('*');
    expect(result.THROTTLE_TTL).toBe(60);
    expect(result.THROTTLE_LIMIT).toBe(100);
    expect(result.APP_NAME).toBe('nestjs-app');
    expect(result.APP_VERSION).toBe('0.0.1');
    expect(result.SHUTDOWN_TIMEOUT).toBe(10000);
  });

  it('coerces PORT from string to number', () => {
    const result = configSchema.parse({ PORT: '8080' });
    expect(result.PORT).toBe(8080);
  });

  it('throws for invalid NODE_ENV value', () => {
    expect(() => configSchema.parse({ NODE_ENV: 'invalid' })).toThrow();
  });

  it('throws for invalid LOG_LEVEL value', () => {
    expect(() => configSchema.parse({ LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('coerces THROTTLE_TTL and THROTTLE_LIMIT from strings', () => {
    const result = configSchema.parse({
      THROTTLE_TTL: '30',
      THROTTLE_LIMIT: '50',
    });
    expect(result.THROTTLE_TTL).toBe(30);
    expect(result.THROTTLE_LIMIT).toBe(50);
  });

  describe('resilience defaults', () => {
    it('applies resilience fallback defaults', () => {
      const parsed = configSchema.parse({});
      expect(parsed.RESILIENCE_RETRY_MAX_ATTEMPTS).toBe(3);
      expect(parsed.RESILIENCE_RETRY_INITIAL_DELAY_MS).toBe(128);
      expect(parsed.RESILIENCE_RETRY_MAX_DELAY_MS).toBe(30000);
      expect(parsed.RESILIENCE_TIMEOUT_MS).toBe(5000);
      expect(parsed.RESILIENCE_CIRCUIT_BREAKER_THRESHOLD).toBe(5);
      expect(parsed.RESILIENCE_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS).toBe(10000);
      expect(parsed.RESILIENCE_BULKHEAD_MAX_CONCURRENT).toBe(10);
      expect(parsed.RESILIENCE_BULKHEAD_MAX_QUEUE).toBe(0);
    });

    it('coerces resilience values from strings', () => {
      const parsed = configSchema.parse({ RESILIENCE_RETRY_MAX_ATTEMPTS: '7' });
      expect(parsed.RESILIENCE_RETRY_MAX_ATTEMPTS).toBe(7);
    });
  });
});

it('requires explicit origins for credentials and rejects ambiguous feature flags', () => {
  expect(
    configSchema.parse({ FEATURE_MONITORING: 'false' }).FEATURE_MONITORING,
  ).toBe(false);
  expect(
    configSchema.parse({ FEATURE_RESILIENCE: 'true' }).FEATURE_RESILIENCE,
  ).toBe(true);
  expect(() => configSchema.parse({ FEATURE_MONITORING: 'yes' })).toThrow();
  expect(() => configSchema.parse({ CORS_CREDENTIALS: 'true' })).toThrow();
  expect(
    configSchema.parse({
      CORS_CREDENTIALS: 'true',
      CORS_ORIGINS: 'https://example.com',
    }).CORS_CREDENTIALS,
  ).toBe(true);
});

it('rejects invalid listening ports and malformed CORS allowlists', () => {
  expect(() => configSchema.parse({ PORT: 65536 })).toThrow();
  for (const CORS_ORIGINS of [
    '',
    ',',
    'https://example.com,',
    'file:///tmp',
    'https://example.com/path',
  ]) {
    expect(() => configSchema.parse({ CORS_ORIGINS })).toThrow();
  }
});

it('supports every built-in Pino level including fatal and silent', () => {
  for (const LOG_LEVEL of [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
  ]) {
    expect(configSchema.parse({ LOG_LEVEL }).LOG_LEVEL).toBe(LOG_LEVEL);
  }
});

it('bounds the optional readiness drain window by the shutdown deadline', () => {
  expect(configSchema.parse({}).SHUTDOWN_DRAIN_DELAY_MS).toBe(0);
  expect(
    configSchema.parse({ SHUTDOWN_DRAIN_DELAY_MS: '1000' })
      .SHUTDOWN_DRAIN_DELAY_MS,
  ).toBe(1000);
  for (const delay of [-1, 10000])
    expect(() =>
      configSchema.parse({ SHUTDOWN_DRAIN_DELAY_MS: delay }),
    ).toThrow();
});
