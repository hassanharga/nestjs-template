import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConditionalModule, ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { API_MODULES } from './features/api.modules';
import { configSchema } from './common/config/config.schema';

import { AppConfigModule } from './common/config/config.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HealthModule } from './common/health/health.module';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { ResilienceModule } from './common/resilience';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    HealthModule,
    ...API_MODULES,
    ConditionalModule.registerWhen(
      MonitoringModule,
      (env) => configSchema.parse(env).FEATURE_MONITORING,
      { debug: false },
    ),
    ConditionalModule.registerWhen(
      ResilienceModule,
      (env) => configSchema.parse(env).FEATURE_RESILIENCE,
      { debug: false },
    ),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
