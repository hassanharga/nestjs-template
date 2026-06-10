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
