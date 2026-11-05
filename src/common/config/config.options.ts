import { ConfigModuleOptions } from '@nestjs/config';
import { join } from 'node:path';
import { configSchema } from './config.schema';

export function configurationOptions(
  root = process.cwd(),
  environment = process.env.NODE_ENV ?? 'development',
): ConfigModuleOptions {
  return {
    isGlobal: true,
    // Nest takes the first file's value; existing process environment wins all files.
    envFilePath: ['.env.local', `.env.${environment}`, '.env'].map((file) =>
      join(root, file),
    ),
    validate: (values) => configSchema.parse(values),
  };
}
