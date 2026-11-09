import { parseTelemetryOptions } from './options';

describe('telemetry configuration', () => {
  it('keeps collector-free startup disabled and validates explicit enablement', () => {
    expect(parseTelemetryOptions({}, 'api').FEATURE_TELEMETRY).toBe(false);
    expect(() =>
      parseTelemetryOptions({ FEATURE_TELEMETRY: 'yes' }, 'api'),
    ).toThrow();
    expect(() =>
      parseTelemetryOptions({ FEATURE_TELEMETRY: 'true' }, 'api'),
    ).toThrow();
    expect(() =>
      parseTelemetryOptions(
        { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://user:secret@example.test' },
        'api',
      ),
    ).toThrow();
    expect(
      parseTelemetryOptions(
        {
          FEATURE_TELEMETRY: 'true',
          OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.test',
        },
        'api',
      ).OTEL_SERVICE_NAME,
    ).toBe('api');
  });
});
