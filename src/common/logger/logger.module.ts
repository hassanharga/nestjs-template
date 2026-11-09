import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { telemetryLogStream } from '../telemetry/log-stream';
import { createHttpLoggerOptions } from './logger.options';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: config.get<boolean>('FEATURE_TELEMETRY', false)
          ? [createHttpLoggerOptions(config), telemetryLogStream()]
          : createHttpLoggerOptions(config),
      }),
    }),
  ],
})
export class AppLoggerModule {}
