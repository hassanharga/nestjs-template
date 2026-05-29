import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDev = config.get<string>('NODE_ENV') === 'development';
        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL', 'info'),
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: "yyyy-mm-dd'T'HH:MM:ss.l'Z'",
                  },
                }
              : undefined,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const headerValue = req.headers['x-request-id'];
              const requestId =
                (typeof headerValue === 'string' ? headerValue : undefined) ??
                randomUUID();

              req.id = requestId;
              res.setHeader('x-request-id', requestId);

              return requestId;
            },
            autoLogging: true,
            // customLogLevel: (
            //   _req: IncomingMessage,
            //   res: ServerResponse,
            //   err?: Error,
            // ) => {
            //   if (err || res.statusCode >= 400) return 'error';
            //   return 'info';
            // },
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.confirmPassword',
            ],
          },
        };
      },
    }),
  ],
})
export class AppLoggerModule {}
