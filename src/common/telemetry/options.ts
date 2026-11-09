import { z } from 'zod';

const absent = (value: unknown) => (value === '' ? undefined : value);
export function telemetrySchema(serviceName: string) {
  return z.object({
    FEATURE_TELEMETRY: z.preprocess(
      (value) =>
        value === 'true' ? true : value === 'false' ? false : absent(value),
      z.boolean().default(false),
    ),
    OTEL_SERVICE_NAME: z.preprocess(
      absent,
      z
        .string()
        .regex(
          /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/,
          'Use a static service identifier',
        )
        .default(serviceName),
    ),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
      absent,
      z
        .url()
        .refine((value) => {
          const url = new URL(value);
          return (
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash
          );
        }, 'Use an HTTP(S) collector base endpoint without credentials, query or fragment')
        .optional(),
    ),
    OTEL_EXPORTER_OTLP_HEADERS: z.string().max(8192).default(''),
    OTEL_TRACES_SAMPLER_ARG: z.preprocess(
      absent,
      z.coerce.number().min(0).max(1).default(1),
    ),
  });
}
export type TelemetryOptions = z.infer<ReturnType<typeof telemetrySchema>>;
export function validateTelemetryEndpoint(
  value: Pick<
    TelemetryOptions,
    'FEATURE_TELEMETRY' | 'OTEL_EXPORTER_OTLP_ENDPOINT'
  >,
  context: z.RefinementCtx,
) {
  if (value.FEATURE_TELEMETRY && !value.OTEL_EXPORTER_OTLP_ENDPOINT) {
    context.addIssue({
      code: 'custom',
      path: ['OTEL_EXPORTER_OTLP_ENDPOINT'],
      message:
        'An explicit collector endpoint is required when telemetry is enabled',
    });
  }
}
export function parseTelemetryOptions(
  source: Record<string, unknown>,
  serviceName: string,
) {
  return telemetrySchema(serviceName)
    .superRefine(validateTelemetryEndpoint)
    .parse(source);
}
