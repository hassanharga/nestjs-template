/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { Log } from './log.decorator';

describe('Log decorator', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sync method', () => {
    it('logs entry and exit, returns value', () => {
      class TestService {
        @Log()
        greet(name: string): string {
          return `hello ${name}`;
        }
      }

      const service = new TestService();
      const result = service.greet('world');

      expect(result).toBe('hello world');
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toMatchObject({
        event: 'method.called',
        method: 'greet',
      });
      expect(logSpy.mock.calls[1][0]).toMatchObject({
        event: 'method.completed',
        method: 'greet',
        durationMs: expect.any(Number) as number,
      });
    });
  });

  describe('async method', () => {
    it('logs entry and exit, returns resolved value', async () => {
      class TestService {
        @Log()
        async fetch(id: number): Promise<{ id: number }> {
          return Promise.resolve({ id });
        }
      }

      const service = new TestService();
      const result = await service.fetch(42);

      expect(result).toEqual({ id: 42 });
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toMatchObject({
        event: 'method.called',
        method: 'fetch',
      });
      expect(logSpy.mock.calls[1][0]).toMatchObject({
        event: 'method.completed',
        method: 'fetch',
        durationMs: expect.any(Number) as number,
      });
    });
  });
});

it('redacts opted-in payloads and excludes payloads by default', () => {
  const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  class Service {
    @Log() quiet(value: unknown) {
      return value;
    }
    @Log({ args: true, result: true }) explicit(value: unknown) {
      return value;
    }
  }
  const service = new Service();
  service.quiet('secret-default');
  service.explicit({
    password: 'secret-password',
    nested: { accessToken: 'secret-token' },
  });
  const logged = JSON.stringify(spy.mock.calls);
  expect(logged).not.toContain('secret-default');
  expect(logged).not.toContain('secret-password');
  expect(logged).not.toContain('secret-token');
  spy.mockRestore();
});

it('bounds opted-in serialization and does not invoke payload accessors', () => {
  const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const getter = jest.fn(() => 'accessor-secret');
  const payload = Object.defineProperty(
    { name: 'x'.repeat(10000), nested: { secret: 'nested-secret' } },
    'computed',
    { get: getter, enumerable: true },
  );
  class Service {
    @Log({ args: true, result: true }) work(value: unknown) {
      return value;
    }
  }
  try {
    new Service().work(payload);
    expect(getter).not.toHaveBeenCalled();
    for (const [line] of spy.mock.calls)
      expect(JSON.stringify(line).length).toBeLessThan(2200);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('nested-secret');
  } finally {
    spy.mockRestore();
  }
});

it('does not copy exception messages into method logs', () => {
  const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  class Service {
    @Log() work() {
      throw new Error('private-error-secret');
    }
  }
  try {
    expect(() => new Service().work()).toThrow('private-error-secret');
    expect(JSON.stringify(spy.mock.calls)).not.toContain(
      'private-error-secret',
    );
  } finally {
    spy.mockRestore();
  }
});

it('keeps rejected methods structured and preserves the original rejection', async () => {
  const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  const failure = new Error('private-async-message');
  class Service {
    @Log() work(): Promise<never> {
      return Promise.reject(failure);
    }
  }
  try {
    await expect(new Service().work()).rejects.toBe(failure);
    expect(spy).toHaveBeenCalledWith({
      event: 'method.failed',
      method: 'work',
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(
      'private-async-message',
    );
  } finally {
    spy.mockRestore();
  }
});
