import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
  CORS_ORIGINS: z.string().default('*'),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  APP_NAME: z.string().default('nestjs-app'),
  APP_VERSION: z.string().default('1.0.0'),
  SHUTDOWN_TIMEOUT: z.coerce.number().int().positive().default(10000),
  HEALTH_MEMORY_HEAP_MB: z.coerce.number().int().positive().default(150),
  HEALTH_RSS_MEMORY_MB: z.coerce.number().int().positive().default(150),
  HEALTH_DISK_THRESHOLD_PERCENT: z.coerce.number().min(0).max(1).default(0.95),
  RESILIENCE_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
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
});

export type AppConfig = z.infer<typeof configSchema>;
