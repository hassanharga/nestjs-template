/* eslint-disable no-console */
import 'reflect-metadata';
import { bootstrapFailureRecord } from './bootstrap-failure';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import initializeConfig from './main.config';
import setupSwagger from './main.swagger';
import { shutdown } from './main.shutdown';
import { Logger } from '@nestjs/common';
import { telemetryHttp } from './common/telemetry/http.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const appName = config.get<string>('APP_NAME', 'nestjs-app');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  const logger = new Logger(appName);

  if (config.get<boolean>('FEATURE_TELEMETRY', false)) {
    const { startTelemetry } = await import('./common/telemetry/runtime');
    startTelemetry(
      {
        FEATURE_TELEMETRY: true,
        OTEL_SERVICE_NAME: config.get<string>('OTEL_SERVICE_NAME'),
        OTEL_EXPORTER_OTLP_ENDPOINT: config.get<string>(
          'OTEL_EXPORTER_OTLP_ENDPOINT',
        ),
        OTEL_EXPORTER_OTLP_HEADERS: config.get<string>(
          'OTEL_EXPORTER_OTLP_HEADERS',
        ),
        OTEL_TRACES_SAMPLER_ARG: config.get<number>('OTEL_TRACES_SAMPLER_ARG'),
      },
      'nestjs-api',
    );
  }
  app.use(telemetryHttp);
  initializeConfig(app, config);

  if (nodeEnv !== 'production') {
    setupSwagger(app, config);
  }

  shutdown(app, config);

  await app.listen(port, () => {
    logger.log({
      event: 'app.started',
      appName,
      port,
      environment: nodeEnv,
      monitoring: config.get<boolean>('FEATURE_MONITORING', false),
      resilience: config.get<boolean>('FEATURE_RESILIENCE', false),
    });
    if (nodeEnv !== 'production')
      logger.log({ event: 'app.swagger.enabled', path: '/api' });
  });
}

bootstrap().catch((err) => {
  // DI may have failed before the configured logger exists. Keep the fallback structured.
  console.error(JSON.stringify(bootstrapFailureRecord(err)));
  process.exit(1);
});
