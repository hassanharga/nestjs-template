import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { configSchema } from '../common/config/config.schema';
import { API_MODULES } from '../features/api.modules';

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: true,
      ignoreEnvVars: true,
      skipProcessEnv: true,
      load: [
        () => configSchema.parse({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
      ],
    }),
    ...API_MODULES,
    LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
  ],
})
export class OpenApiExportModule {}
