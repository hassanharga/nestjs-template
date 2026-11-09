import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { installTelemetryRuntime, TelemetryRuntime } from './bridge';
import { telemetryHttp } from './http.middleware';

afterEach(() => installTelemetryRuntime(undefined));
it.each(['/v1/items', '/api/v1/items'])(
  'traces business requests under %s and forwards only the trace parent',
  (path) => {
    const run = jest.fn((next: () => void) => next());
    const end = jest.fn();
    const server = jest.fn(() => ({ run, end }));
    installTelemetryRuntime({ server } as unknown as TelemetryRuntime);
    const response = Object.assign(new EventEmitter(), {
      writableFinished: true,
      statusCode: 201,
    });
    const next = jest.fn();
    telemetryHttp(
      {
        path,
        headers: { traceparent: 'parent', baggage: 'private' },
      } as unknown as Request,
      response as unknown as Response,
      next,
    );
    expect(server).toHaveBeenCalledWith('parent');
    expect(next).toHaveBeenCalledTimes(1);
    response.emit('finish');
    expect(end).toHaveBeenCalledWith(201);
  },
);
it.each([
  '/health/live',
  '/health/ready',
  '/metrics',
  '/api',
  '/api/swagger-ui.css',
])('does not trace infrastructure %s', (path) => {
  const server = jest.fn();
  installTelemetryRuntime({ server } as unknown as TelemetryRuntime);
  const next = jest.fn();
  telemetryHttp({ path } as Request, {} as Response, next);
  expect(server).not.toHaveBeenCalled();
  expect(next).toHaveBeenCalledTimes(1);
});
it('keeps disabled startup transparent', () => {
  const next = jest.fn();
  telemetryHttp({} as Request, {} as Response, next);
  expect(next).toHaveBeenCalledTimes(1);
});
