import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { Counter, Histogram, Registry } from 'prom-client';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

function metrics() {
  const registry = new Registry();
  const options = {
    labelNames: ['method', 'path', 'status_code'],
    registers: [registry],
  };
  const counter = new Counter({
    ...options,
    name: 'requests',
    help: 'Requests',
  });
  const histogram = new Histogram({
    ...options,
    name: 'duration',
    help: 'Duration',
  });
  return {
    counter,
    histogram,
    middleware: new HttpMetricsMiddleware(counter, histogram),
  };
}

describe('HTTP metrics completion', () => {
  it('records final failures once across finish and close with route templates', async () => {
    const { counter, histogram, middleware } = metrics();
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      writableFinished: true,
    });
    const req = {
      method: 'GET',
      path: '/items/123',
      route: { path: '/items/:id' },
    };
    middleware.use(
      req as unknown as Request,
      response as unknown as Response,
      jest.fn(),
    );
    response.statusCode = 404;
    response.emit('finish');
    response.emit('close');
    const labels = { method: 'GET', path: '/items/:id', status_code: '404' };
    expect((await counter.get()).values).toEqual([{ labels, value: 1 }]);
    expect((await histogram.get()).values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels,
          value: 1,
          metricName: 'duration_count',
        }),
      ]),
    );
  });

  it('bounds unmatched path labels and includes guard failures', async () => {
    const { counter, middleware } = metrics();
    const response = Object.assign(new EventEmitter(), {
      statusCode: 403,
      writableFinished: true,
    });
    middleware.use(
      { method: 'GET', path: '/arbitrary-user-input' } as unknown as Request,
      response as unknown as Response,
      jest.fn(),
    );
    response.emit('finish');
    expect((await counter.get()).values).toEqual([
      {
        labels: { method: 'GET', path: 'unmatched', status_code: '403' },
        value: 1,
      },
    ]);
  });
});

it('does not observe its own metrics scrape', async () => {
  const { counter, histogram, middleware } = metrics();
  const next = jest.fn();
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: true,
  });
  middleware.use(
    { method: 'GET', path: '/metrics' } as Request,
    res as unknown as Response,
    next,
  );
  res.emit('finish');
  res.emit('close');
  expect(next).toHaveBeenCalledTimes(1);
  expect((await counter.get()).values).toEqual([]);
  expect((await histogram.get()).values).toEqual([]);
});
it('records a disconnect once as synthetic 499 for both instruments', async () => {
  const { counter, histogram, middleware } = metrics();
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: false,
  });
  middleware.use(
    {
      method: 'GET',
      path: '/items/1',
      route: { path: '/items/:id' },
    } as Request,
    res as unknown as Response,
    jest.fn(),
  );
  res.emit('close');
  res.emit('close');
  const labels = { method: 'GET', path: '/items/:id', status_code: '499' };
  expect((await counter.get()).values).toEqual([{ labels, value: 1 }]);
  expect((await histogram.get()).values).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        labels,
        value: 1,
        metricName: 'duration_count',
      }),
    ]),
  );
});
