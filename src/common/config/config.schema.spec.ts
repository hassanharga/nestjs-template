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
    expect(result.APP_VERSION).toBe('1.0.0');
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
    const result = configSchema.parse({ THROTTLE_TTL: '30', THROTTLE_LIMIT: '50' });
    expect(result.THROTTLE_TTL).toBe(30);
    expect(result.THROTTLE_LIMIT).toBe(50);
  });
});
