import { z } from 'zod';

const booleanEnv = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().default(false),
);

export const configSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'staging', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    FEATURE_MONITORING: booleanEnv,
    FEATURE_RESILIENCE: booleanEnv,
    CORS_CREDENTIALS: booleanEnv,
    CORS_ORIGINS: z
      .string()
      .default('*')
      .refine((value) => {
        if (value === '*') return true;
        return value.split(',').every((entry) => {
          try {
            const origin = new URL(entry.trim());
            return (
              ['http:', 'https:'].includes(origin.protocol) &&
              origin.origin === entry.trim()
            );
          } catch {
            return false;
          }
        });
      }, 'Use * or a comma-separated list of HTTP(S) origins'),
    THROTTLE_TTL: z.coerce.number().int().positive().default(60),
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
    APP_NAME: z.string().default('nestjs-app'),
    APP_DESCRIPTION: z.string().default('Application API'),
    APP_REPOSITORY_URL: z.url().optional(),
    APP_VERSION: z.string().default('0.0.1'),
    SHUTDOWN_TIMEOUT: z.coerce.number().int().positive().default(10000),
    SHUTDOWN_DRAIN_DELAY_MS: z.coerce.number().int().nonnegative().default(0),
    HEALTH_MEMORY_HEAP_MB: z.coerce.number().int().positive().default(150),
    HEALTH_RSS_MEMORY_MB: z.coerce.number().int().positive().default(150),
    HEALTH_DISK_THRESHOLD_PERCENT: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.95),
    // Additional retries, not total executions: 3 permits up to four calls.
    RESILIENCE_RETRY_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .positive()
      .default(3),
    RESILIENCE_RETRY_INITIAL_DELAY_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(128),
    RESILIENCE_RETRY_MAX_DELAY_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30000),
    RESILIENCE_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    RESILIENCE_CIRCUIT_BREAKER_THRESHOLD: z.coerce
      .number()
      .int()
      .positive()
      .default(5),
    RESILIENCE_CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10000),
    RESILIENCE_BULKHEAD_MAX_CONCURRENT: z.coerce
      .number()
      .int()
      .positive()
      .default(10),
    RESILIENCE_BULKHEAD_MAX_QUEUE: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(0),
  })
  .superRefine((config, ctx) => {
    if (config.SHUTDOWN_DRAIN_DELAY_MS >= config.SHUTDOWN_TIMEOUT) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHUTDOWN_DRAIN_DELAY_MS'],
        message: 'Drain delay must be less than the total shutdown timeout',
      });
    }
    if (
      config.CORS_CREDENTIALS &&
      config.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Credentialed CORS requires explicit origins',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;
