import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const shutdown = (app: INestApplication, config: ConfigService) => {
  const logger = new Logger();

  const shutdownTimeout = config.get<number>('SHUTDOWN_TIMEOUT', 10000);

  app.enableShutdownHooks();

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    logger.log('Shutting Down Gracefully ...');
    isShuttingDown = true;
    setTimeout(() => process.exit(1), shutdownTimeout).unref();
    void app.close().then(() => {
      logger.log('Shutdown complete');
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};
