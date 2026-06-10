/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { err, ok, Result } from 'neverthrow';
import { Resilience } from './resilience.decorator';
import { ResilienceRegistry } from './resilience.registry';
import { ResilienceDefaults, ResilienceObserverLike } from './resilience.types';

const defaults: ResilienceDefaults = {
  retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 2 },
  timeout: { ms: 50 },
  circuitBreaker: { threshold: 2, halfOpenAfterMs: 10000 },
  bulkhead: { maxConcurrent: 5, maxQueue: 0 },
};

function fakeObserver(): jest.Mocked<ResilienceObserverLike> {
  return {
    recordRetry: jest.fn(),
    recordTimeout: jest.fn(),
    recordBreakerOpen: jest.fn(),
    recordBreakerHalfOpen: jest.fn(),
    recordBreakerClose: jest.fn(),
    recordBulkheadRejection: jest.fn(),
  };
}

describe('@Resilience', () => {
  let observer: jest.Mocked<ResilienceObserverLike>;

  beforeEach(() => {
    observer = fakeObserver();
    ResilienceRegistry.configure(defaults, observer);
  });
  afterEach(() => ResilienceRegistry.reset());

  it('retries a method that throws then succeeds', async () => {
    class Svc {
      calls = 0;
      @Resilience({ name: 'Svc.flaky', retry: true })
      async flaky(): Promise<string> {
        this.calls += 1;
        if (this.calls < 2) throw new Error('boom');
        return 'ok';
      }
    }
    const svc = new Svc();
    await expect(svc.flaky()).resolves.toBe('ok');
    expect(svc.calls).toBe(2);
    expect(observer.recordRetry).toHaveBeenCalledWith('Svc.flaky');
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
    expect(observer.recordRetry).not.toHaveBeenCalled();
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
    expect(result._unsafeUnwrap()).toBe('hi:there');
  });

  it('defaults the policy name to Class.method when name is omitted', async () => {
    class Svc {
      calls = 0;
      @Resilience({ retry: true })
      async flaky(): Promise<string> {
        this.calls += 1;
        if (this.calls < 2) throw new Error('boom');
        return 'ok';
      }
    }
    const svc = new Svc();
    await svc.flaky();
    expect(observer.recordRetry).toHaveBeenCalledWith('Svc.flaky');
  });
});
