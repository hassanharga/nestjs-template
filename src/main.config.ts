import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { INestApplication, VersioningType } from '@nestjs/common';

export default function initializeConfig(
  app: INestApplication,
  config: ConfigService,
) {
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');

  app.useLogger(app.get(Logger));

  app.use(helmet());

  app.enableCors({
    origin:
      corsOrigins === '*' ? '*' : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  // Global prefix
  // app.setGlobalPrefix(apiPrefix, {
  //   exclude: ['health/live', 'health/ready', 'metrics'],
  // });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(new ZodValidationPipe());
}
