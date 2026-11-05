import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Options } from 'pino-http';

export function validatedRequestId(value: unknown): string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value)
    ? value
    : randomUUID();
}

/** Keep diagnostic locations, without copying secrets from Error.message/cause. */
export function safeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { type: 'UnknownError' };
  return {
    type: error.constructor.name.slice(0, 80),
    frames: error.stack
      ?.split('\n')
      .slice(1, 41)
      .flatMap((line) => {
        const location = line.match(
          /(?:\(|\s)((?:node:|file:\/\/|\/)[A-Za-z0-9_./:@%+~-]+:\d+:\d+)\)?$/,
        )?.[1];
        return location ? [location.slice(0, 256)] : [];
      })
      .slice(0, 20),
  };
}

export function createHttpLoggerOptions(config: ConfigService): Options {
  return {
    level: config.get<string>('LOG_LEVEL', 'info'),
    transport:
      config.get<string>('NODE_ENV') === 'development'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true },
          }
        : undefined,
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = validatedRequestId(req.headers['x-request-id']);
      req.id = id;
      res.setHeader('x-request-id', id);
      return id;
    },
    autoLogging: true,
    quietReqLogger: true,
    wrapSerializers: false,
    serializers: {
      req: (req: IncomingMessage & { route?: { path?: unknown } }) => ({
        id: req.id,
        method: req.method,
        route:
          typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
      }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      err: safeError,
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return err ? 'error' : 'info';
    },
    customSuccessMessage: () => 'http.request.completed',
    customErrorMessage: () => 'http.request.failed',
    // Defense in depth for application records that explicitly attach headers.
    redact: {
      paths: [
        'req.headers',
        'res.headers',
        'request.headers',
        'response.headers',
        'headers',
        'password',
        'confirmPassword',
        'token',
        'accessToken',
        'refreshToken',
        'apiKey',
        'authorization',
        'cookie',
        'secret',
        '*.password',
        '*.token',
        '*.apiKey',
        '*.secret',
      ],
      censor: '[Redacted]',
    },
  };
}
