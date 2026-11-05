/* eslint-disable @typescript-eslint/require-await */
import { err, ok, Result } from 'neverthrow';
import { Resilience } from './resilience.decorator';

describe('@Resilience', () => {
  it('retries a method that throws then succeeds', async () => {
    class Svc {
      calls = 0;
      @Resilience({ name: 'Svc.flaky', retry: true })
      async flaky(): Promise<string> {
        this.calls += 1;
        if (this.calls < 2)
          throw Object.assign(new Error('boom'), { code: 'ECONNRESET' });
        return 'ok';
      }
    }
    const svc = new Svc();
    await expect(svc.flaky()).resolves.toBe('ok');
    expect(svc.calls).toBe(2);
  });

  it('does NOT retry a returned err() (throws-only semantics)', async () => {
    class Svc {
      calls = 0;
      @Resilience({ name: 'Svc.result', retry: true })
      async work(): Promise<Result<string, Error>> {
        this.calls += 1;
        return err(new Error('domain failure'));
      }
    }
    const svc = new Svc();
    const result = await svc.work();
    expect(result.isErr()).toBe(true);
    expect(svc.calls).toBe(1);
  });

  it('preserves `this` and arguments', async () => {
    class Svc {
      prefix = 'hi:';
      @Resilience({ name: 'Svc.echo', retry: true })
      async echo(value: string): Promise<Result<string, never>> {
        return ok(this.prefix + value);
      }
    }
    const svc = new Svc();
    const result = await svc.echo('there');
    result.match(
      (value) => expect(value).toBe('hi:there'),
      () => {
        throw new Error('Unexpected err Result');
      },
    );
  });

  it('supports retry options without an explicit name', async () => {
    class Svc {
      calls = 0;
      @Resilience({ retry: true })
      async flaky(): Promise<string> {
        this.calls += 1;
        if (this.calls < 2)
          throw Object.assign(new Error('boom'), { code: 'ECONNRESET' });
        return 'ok';
      }
    }
    const svc = new Svc();
    await svc.flaky();
    expect(svc.calls).toBe(2);
  });
});

it('keeps bulkhead state separate for each service instance', async () => {
  class Service {
    @Resilience({ bulkhead: { maxConcurrent: 1, maxQueue: 0 } })
    async work(): Promise<string> {
      return new Promise((resolve) => setTimeout(() => resolve('ok'), 1));
    }
  }
  await expect(
    Promise.all([new Service().work(), new Service().work()]),
  ).resolves.toEqual(['ok', 'ok']);
});
