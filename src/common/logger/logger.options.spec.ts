import { ConfigService } from '@nestjs/config';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import {
  createHttpLoggerOptions,
  safeError,
  validatedRequestId,
} from './logger.options';

const config = (values: Record<string, unknown> = {}) =>
  ({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  }) as ConfigService;

it('accepts bounded correlation IDs and replaces unsafe header values', () => {
  expect(validatedRequestId('trace-123_abc:1.2')).toBe('trace-123_abc:1.2');
  for (const value of [
    '',
    'x'.repeat(129),
    'line\nbreak',
    'spaces forbidden',
    ['ambiguous'],
  ]) {
    expect(validatedRequestId(value)).toMatch(/^[a-f0-9-]{36}$/);
  }
});

it('omits URL, query, headers, body and raw error messages from defaults', () => {
  const options = createHttpLoggerOptions(config());
  const req = {
    id: 'safe-id',
    method: 'POST',
    url: '/password-secret?token=query-secret',
    headers: { authorization: 'Bearer header-secret', cookie: 'cookie-secret' },
    body: { password: 'body-secret' },
    route: { path: '/items/:id' },
  };
  const res = { statusCode: 500, headers: { 'set-cookie': 'response-secret' } };
  const serialized = JSON.stringify({
    req: options.serializers!.req(req) as unknown,
    res: options.serializers!.res(res) as unknown,
    err: safeError(new Error('error-secret\n at injected-secret')),
  });
  expect(serialized).not.toContain('secret');
  expect(JSON.parse(serialized)).toMatchObject({
    req: { id: 'safe-id', method: 'POST', route: '/items/:id' },
    res: { statusCode: 500 },
  });
});

it('echoes correlation IDs and assigns warning/error completion levels', () => {
  const options = createHttpLoggerOptions(config());
  const req = new IncomingMessage(new Socket());
  req.headers['x-request-id'] = 'accepted-id';
  const res = new ServerResponse(req);
  expect(options.genReqId!(req, res)).toBe('accepted-id');
  expect(res.getHeader('x-request-id')).toBe('accepted-id');
  expect(options.customLogLevel!(req, res)).toBe('info');
  res.statusCode = 400;
  expect(options.customLogLevel!(req, res)).toBe('warn');
  res.statusCode = 503;
  expect(options.customLogLevel!(req, res)).toBe('error');
  expect(options.customErrorMessage!(req, res, new Error('private'))).toBe(
    'http.request.failed',
  );
});

it('uses pretty output only for development and honors silent/fatal levels', () => {
  expect(
    createHttpLoggerOptions(config({ NODE_ENV: 'development' })).transport,
  ).toBeDefined();
  expect(
    createHttpLoggerOptions(
      config({ NODE_ENV: 'production', LOG_LEVEL: 'silent' }),
    ).level,
  ).toBe('silent');
  expect(createHttpLoggerOptions(config({ LOG_LEVEL: 'fatal' })).level).toBe(
    'fatal',
  );
});
