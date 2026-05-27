import { z } from 'zod';

export const configSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
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
});

export type AppConfig = z.infer<typeof configSchema>;
