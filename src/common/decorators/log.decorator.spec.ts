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
      expect(logSpy.mock.calls[0][0]).toMatch(/\[greet\] called/);
      expect(logSpy.mock.calls[1][0]).toMatch(/\[greet\] completed in \d+ms/);
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
      expect(logSpy.mock.calls[0][0]).toMatch(/\[fetch\] called/);
      expect(logSpy.mock.calls[1][0]).toMatch(/\[fetch\] completed in \d+ms/);
    });
  });
});
