/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import initializeConfig from './main.config';
import setupSwagger from './main.swagger';
import { shutdown } from './main.shutdown';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);
  const appName = config.get<string>('APP_NAME', 'nestjs-app');
  const nodeEnv = config.get<string>('NODE_ENV', 'development');

  const logger = new Logger('APP');

  initializeConfig(app, config);

  if (nodeEnv !== 'production') {
    setupSwagger(app, config);
  }

  shutdown(app, config);

  await app.listen(port, () => {
    logger.log(`${appName} is running on port ${port} in ${nodeEnv} mode`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
