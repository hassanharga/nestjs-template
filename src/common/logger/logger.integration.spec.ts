import { ConfigService } from '@nestjs/config';
import { createServer } from 'node:http';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import * as request from 'supertest';
import { createHttpLoggerOptions } from './logger.options';

it('writes safe correlated JSON for successful and failed HTTP requests', async () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const config = {
    get: (key: string, fallback?: unknown) =>
      key === 'NODE_ENV' ? 'production' : fallback,
  } as ConfigService;
  const middleware = pinoHttp(createHttpLoggerOptions(config), stream);
  const server = createServer((req, res) => {
    middleware(req, res);
    res.setHeader('set-cookie', 'session=response-secret');
    res.statusCode = req.headers['x-test-status']
      ? Number(req.headers['x-test-status'])
      : 200;
    req.log.info(
      { headers: req.headers, apiKey: 'record-secret' },
      'application.event',
    );
    res.end('ok');
  });
  for (const status of [200, 400, 500]) {
    await request(server)
      .get('/path-secret?token=query-secret')
      .set('authorization', 'Bearer auth-secret')
      .set('cookie', 'session=cookie-secret')
      .set('x-api-key', 'key-secret')
      .set('x-request-id', `request-${status}`)
      .set('x-test-status', String(status))
      .expect(status)
      .expect('x-request-id', `request-${status}`);
  }
  const raw = lines.join('');
  expect(raw).not.toContain('secret');
  const records = raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  for (const [status, level] of [
    [200, 30],
    [400, 40],
    [500, 50],
  ]) {
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reqId: `request-${status}`,
          level,
          res: { statusCode: status },
        }),
      ]),
    );
  }
  expect(raw).not.toContain('stack');
});
