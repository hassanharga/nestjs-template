import { exporterHeaders, logMetadata, logSeverity } from './privacy';

it.each([
  [10, 1, 'TRACE'],
  [20, 5, 'DEBUG'],
  [30, 9, 'INFO'],
  [40, 13, 'WARN'],
  [50, 17, 'ERROR'],
  [60, 21, 'FATAL'],
  ['warn', 13, 'WARN'],
  ['unknown', 9, 'INFO'],
])(
  'maps log level %s without losing trace/fatal severity',
  (level, severityNumber, severityText) => {
    expect(logSeverity(level)).toEqual({ severityNumber, severityText });
  },
);
it('exports only bounded metadata and decodes collector credentials without exposing errors', () => {
  expect(
    logMetadata({
      context: {
        requestId: 'job.1',
        method: 'get',
        status: 200,
        password: 'private',
        durationMs: Infinity,
      },
    }),
  ).toEqual({ requestId: 'job.1', method: 'GET', status: 200 });
  expect(exporterHeaders('Authorization=Bearer%20test')).toEqual({
    Authorization: 'Bearer test',
  });
  expect(() => exporterHeaders('Authorization=private%')).toThrow(
    'Invalid OTEL_EXPORTER_OTLP_HEADERS format',
  );
});
