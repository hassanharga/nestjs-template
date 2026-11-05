import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { INestApplication, VersioningType } from '@nestjs/common';

export function configureApplication(
  app: INestApplication,
  config: ConfigService,
) {
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');

  app.useLogger(app.get(Logger));

  app.use(helmet());

  app.enableCors({
    origin:
      corsOrigins === '*' ? '*' : corsOrigins.split(',').map((o) => o.trim()),
    credentials: config.get<boolean>('CORS_CREDENTIALS', false),
  });

  // Global prefix
  // app.setGlobalPrefix(apiPrefix, {
  //   exclude: ['health/live', 'health/ready', 'metrics'],
  // });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new ZodValidationPipe());
}

export default configureApplication;
