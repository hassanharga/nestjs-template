/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(() => {
    controller = new HealthController(
      null as any,
      null as any,
      null as any,
      null as any,
    );
  });

  it('GET /health/live returns { status: ok }', () => {
    expect(controller.live()).toEqual({ status: 'ok' });
  });
});

// RSS must use the resident-set indicator rather than the heap indicator.
it('checks heap and RSS independently', async () => {
  const memory = { checkHeap: jest.fn(), checkRSS: jest.fn() };
  const controller = new HealthController(
    {
      check: (checks: Array<() => unknown>) => checks.map((check) => check()),
    } as any,
    memory as any,
    { checkStorage: jest.fn() } as any,
    { get: () => 1 } as any,
  );
  await controller.ready();
  expect(memory.checkRSS).toHaveBeenCalledWith('memory_rss', 1024 * 1024);
  expect(memory.checkHeap).toHaveBeenCalledTimes(1);
});
