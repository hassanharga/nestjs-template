import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { INestApplication } from '@nestjs/common';

export default function initializeConfig(
  app: INestApplication,
  config: ConfigService,
) {
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');

  app.use(helmet());

  app.enableCors({
    origin:
      corsOrigins === '*' ? '*' : corsOrigins.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  // AllExceptionsFilter registered first — NestJS applies last-registered first,
  // so HttpExceptionFilter runs first (handles known HTTP errors), then AllExceptionsFilter (catches the rest).
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  app.useLogger(app.get(Logger));
}
