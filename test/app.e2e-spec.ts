/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { configureApplication } from '../src/main.config';
import { DrainState } from '../src/common/health/drain-state';
import { Controller, Get, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { shutdown } from '../src/main.shutdown';

let notifyStarted: (() => void) | undefined;
let requestGate = Promise.resolve();

@Controller()
class ShutdownProbeController {
  @Get('shutdown-probe')
  async pending(): Promise<string> {
    notifyStarted?.();
    await requestGate;
    return 'completed';
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let closed: boolean;

  beforeEach(async () => {
    closed = false;
    notifyStarted = undefined;
    requestGate = Promise.resolve();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ShutdownProbeController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app, app.get(ConfigService));
    await app.init();
  });

  afterEach(async () => {
    if (!closed) await app.close();
  });

  it('/v1 (GET) returns the response envelope', () => {
    return request(app.getHttpServer())
      .get('/v1')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 200,
          success: true,
          data: 'Hello World!',
          error: null,
        });
        expect(res.body.timestamp).toBeDefined();
      });
  });
  it('validates inputs through production setup', async () => {
    await request(app.getHttpServer())
      .post('/v1/items')
      .send({ id: -1, name: '' })
      .expect(400)
      .expect((res) => {
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.status).toBe(400);
      });
  });

  it('preserves final created and not-found statuses', async () => {
    await request(app.getHttpServer())
      .post('/v1/items')
      .send({ id: 1, name: 'Item' })
      .expect(201)
      .expect((res) => expect(res.body.status).toBe(201));
    await request(app.getHttpServer())
      .get('/v1/items/999')
      .expect(404)
      .expect((res) => expect(res.body.status).toBe(404));
  });

  it('keeps health neutral and leaves draining errors unwrapped', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
    app.get(DrainState).draining = true;
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect((res) => {
        expect(res.body.success).toBeUndefined();
        expect(res.body.statusCode).toBe(503);
      });
  });
  it('replaces invalid request IDs and correlates error responses', async () => {
    await request(app.getHttpServer())
      .get('/v1/items/999')
      .set('x-request-id', 'invalid id')
      .expect(404)
      .expect((res) => {
        expect(res.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
        expect(res.body.requestId).toBe(res.headers['x-request-id']);
      });
  });

  it('handles malformed JSON with a response correlation ID', async () => {
    await request(app.getHttpServer())
      .post('/v1/items')
      .set('content-type', 'application/json')
      .send('{invalid')
      .expect(400)
      .expect((res) => {
        expect(res.body.requestId).toBe(res.headers['x-request-id']);
        expect(res.body.status).toBe(400);
      });
  });

  it('answers CORS preflights without credentials by default', async () => {
    await request(app.getHttpServer())
      .options('/v1/items')
      .set('origin', 'https://client.example')
      .set('access-control-request-method', 'POST')
      .expect(204)
      .expect((res) => {
        expect(res.headers['access-control-allow-origin']).toBe('*');
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      });
  });

  it('finishes an active HTTP request while a signal drains and closes the app', async () => {
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    let release: (() => void) | undefined;
    requestGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const signals: Record<string, () => void> = {};
    const on = jest.spyOn(process, 'on').mockImplementation(((
      event: string,
      handler: () => void,
    ) => {
      signals[event] = handler;
      return process;
    }) as typeof process.on);
    try {
      shutdown(app, app.get(ConfigService));
    } finally {
      on.mockRestore();
    }
    const realClose = app.close.bind(app) as INestApplication<App>['close'];
    let closing: Promise<void> | undefined;
    const close = jest.spyOn(app, 'close').mockImplementation(() => {
      closing = realClose();
      return closing;
    });
    const pending = request(app.getHttpServer())
      .get('/v1/shutdown-probe')
      .then((response) => response);
    try {
      await started;
      signals.SIGTERM();
      expect(app.get(DrainState).draining).toBe(true);
      expect(close).toHaveBeenCalledTimes(1);
      release?.();
      const response = await pending;
      expect(response.status).toBe(200);
      expect(response.body.data).toBe('completed');
      if (!closing) throw new Error('Shutdown did not begin');
      await closing;
      closed = true;
    } finally {
      release?.();
      close.mockRestore();
    }
  });
});
