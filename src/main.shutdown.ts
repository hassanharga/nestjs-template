import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DrainState } from './common/health/drain-state';
import { stopTelemetry } from './common/telemetry/bridge';
import { safeError } from './common/logger/logger.options';

/** One owner for signal handling; do not also enable Nest signal hooks. */
export const shutdown = (app: INestApplication, config: ConfigService) => {
  const logger = new Logger('Shutdown');
  let closing = false;
  const close = (signal: string) => {
    if (closing) return;
    closing = true;
    const shutdownId = randomUUID();
    const timeoutMs = config.get<number>('SHUTDOWN_TIMEOUT', 10000);
    app.get(DrainState).draining = true;
    const drainDelayMs = config.get<number>('SHUTDOWN_DRAIN_DELAY_MS', 0);
    logger.log({
      event: 'shutdown.started',
      shutdownId,
      signal,
      timeoutMs,
      drainDelayMs,
    });
    const timer = setTimeout(() => {
      logger.error({ event: 'shutdown.timeout', shutdownId, timeoutMs });
      process.exit(1);
    }, timeoutMs);
    timer.unref();
    const beginClose = () => {
      void app
        .close()
        .then(async () => {
          process.removeListener('SIGTERM', onTerm);
          process.removeListener('SIGINT', onInt);
          logger.log({ event: 'shutdown.completed', shutdownId });
          await stopTelemetry();
          clearTimeout(timer);
        })
        .catch((error: unknown) => {
          logger.error({
            event: 'shutdown.failed',
            shutdownId,
            error: safeError(error),
          });
          process.exitCode = 1;
        });
    };
    if (drainDelayMs > 0) setTimeout(beginClose, drainDelayMs);
    else beginClose();
  };
  const onTerm = () => close('SIGTERM');
  const onInt = () => close('SIGINT');
  process.on('SIGTERM', onTerm);
  process.on('SIGINT', onInt);
};
