import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { App } from 'supertest/types';
import type { MetricsRegistry as MetricsRegistryType } from './common/monitoring/metrics.registry';
import type { ResilienceRegistry as ResilienceRegistryType } from './common/resilience/resilience.registry';

const combinations = [
  { monitoring: false, resilience: false },
  { monitoring: true, resilience: false },
  { monitoring: false, resilience: true },
  { monitoring: true, resilience: true },
];

describe.each(combinations)(
  'application modules $monitoring/$resilience',
  ({ monitoring, resilience }) => {
    it('boots the configured modules and keeps registries isolated', async () => {
      const original = { ...process.env };
      try {
        process.env.NODE_ENV = 'test';
        process.env.LOG_LEVEL = 'silent';
        process.env.FEATURE_MONITORING = String(monitoring);
        process.env.FEATURE_RESILIENCE = String(resilience);
        await jest.isolateModulesAsync(async () => {
          const { Test } = await import('@nestjs/testing');
          const { ConfigService } = await import('@nestjs/config');
          const { AppModule } = await import('./app.module');
          const { configureApplication } = await import('./main.config');
          const { MetricsRegistry } =
            await import('./common/monitoring/metrics.registry');
          const { ResilienceRegistry } =
            await import('./common/resilience/resilience.registry');
          const { register } = await import('prom-client');
          const globalNames = register
            .getMetricsAsArray()
            .map((metric) => metric.name);
          const apps: INestApplication<App>[] = [];
          try {
            // A second app catches duplicate default collectors and singleton policy state.
            for (let index = 0; index < 2; index++) {
              const module = await Test.createTestingModule({
                imports: [AppModule],
              }).compile();
              const app = module.createNestApplication<INestApplication<App>>({
                bufferLogs: true,
              });
              apps.push(app);
              configureApplication(app, app.get(ConfigService));
              await app.init();
              const response = await request(app.getHttpServer())
                .get('/v1')
                .set('x-request-id', `module-${index}`)
                .expect(200);
              expect((response.body as { data: unknown }).data).toBe(
                'Hello World!',
              );
              expect(response.headers['x-request-id']).toBe(`module-${index}`);
              await request(app.getHttpServer())
                .get('/health/live')
                .expect(200)
                .expect({ status: 'ok' });
              await request(app.getHttpServer())
                .get('/v1/items/999')
                .expect(404)
                .expect((res) => {
                  expect((res.body as { requestId: string }).requestId).toBe(
                    res.headers['x-request-id'],
                  );
                });
              if (monitoring) {
                await request(app.getHttpServer())
                  .get('/metrics')
                  .expect(200)
                  .expect((res) => {
                    expect(res.text).toContain('http_requests_total');
                    expect(res.text).toContain('path="/v1/items/:id"');
                    expect(res.text).toContain('process_');
                  });
                expect(
                  app
                    .get<MetricsRegistryType>(MetricsRegistry)
                    .getSingleMetric('http_requests_total'),
                ).toBeDefined();
              } else {
                await request(app.getHttpServer()).get('/metrics').expect(404);
                expect(() =>
                  app.get<MetricsRegistryType>(MetricsRegistry),
                ).toThrow();
              }
              if (resilience) {
                const registry =
                  app.get<ResilienceRegistryType>(ResilienceRegistry);
                let attempts = 0;
                await expect(
                  registry
                    .create({
                      name: 'module.probe',
                      retry: { initialDelayMs: 1, maxDelayMs: 1 },
                    })
                    .execute(() => {
                      attempts++;
                      if (attempts === 1)
                        throw Object.assign(new Error('transient'), {
                          code: 'ECONNRESET',
                        });
                      return 'recovered';
                    }),
                ).resolves.toBe('recovered');
                expect(attempts).toBe(2);
                if (monitoring)
                  expect(
                    await app
                      .get<MetricsRegistryType>(MetricsRegistry)
                      .metrics(),
                  ).toContain(
                    'resilience_retries_total{policy="module.probe"} 1',
                  );
              } else
                expect(() =>
                  app.get<ResilienceRegistryType>(ResilienceRegistry),
                ).toThrow();
            }
            if (monitoring)
              expect(
                apps[0].get<MetricsRegistryType>(MetricsRegistry),
              ).not.toBe(apps[1].get<MetricsRegistryType>(MetricsRegistry));
            if (resilience)
              expect(
                apps[0].get<ResilienceRegistryType>(ResilienceRegistry),
              ).not.toBe(
                apps[1].get<ResilienceRegistryType>(ResilienceRegistry),
              );
            expect(
              register.getMetricsAsArray().map((metric) => metric.name),
            ).toEqual(globalNames);
          } finally {
            for (const app of apps.reverse()) await app.close();
          }
        });
      } finally {
        for (const key of Object.keys(process.env))
          if (!(key in original)) delete process.env[key];
        Object.assign(process.env, original);
      }
    });
  },
);
