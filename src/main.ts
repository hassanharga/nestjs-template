import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc, ZodValidationPipe } from 'nestjs-zod';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const appName = config.get<string>('APP_NAME', 'nestjs-app');
  const appVersion = config.get<string>('APP_VERSION', '1.0.0');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const corsOrigins = config.get<string>('CORS_ORIGINS', '*');
  const shutdownTimeout = config.get<number>('SHUTDOWN_TIMEOUT', 10000);

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

  if (nodeEnv !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(appName)
        .setVersion(appVersion)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(document));
  }

  app.enableShutdownHooks();

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    setTimeout(() => process.exit(1), shutdownTimeout).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
