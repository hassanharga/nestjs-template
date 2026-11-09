import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { shutdown } from './main.shutdown';
import { DrainState } from './common/health/drain-state';

it('marks readiness draining and closes once without duplicate Nest hooks', async () => {
  const listeners: Record<string, () => void> = {};
  const on = jest.spyOn(process, 'on').mockImplementation(((
    event: string,
    callback: () => void,
  ) => {
    listeners[event] = callback;
    return process;
  }) as typeof process.on);
  const remove = jest.spyOn(process, 'removeListener').mockReturnValue(process);
  const drain = new DrainState();
  const close = jest.fn().mockResolvedValue(undefined);
  const enableShutdownHooks = jest.fn();
  const log = jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation(() => undefined);
  try {
    shutdown(
      {
        get: () => drain,
        close,
        enableShutdownHooks,
      } as unknown as INestApplication,
      {
        get: (key: string) => (key === 'SHUTDOWN_DRAIN_DELAY_MS' ? 0 : 1000),
      } as unknown as ConfigService,
    );
    listeners.SIGTERM();
    listeners.SIGINT();
    expect(drain.draining).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledWith();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'shutdown.started',
        signal: 'SIGTERM',
        timeoutMs: 1000,
      }),
    );
    expect(enableShutdownHooks).not.toHaveBeenCalled();
    await Promise.resolve();
  } finally {
    on.mockRestore();
    remove.mockRestore();
    log.mockRestore();
  }
});

it('forces a bounded shutdown when close never finishes', () => {
  jest.useFakeTimers();
  const listeners: Record<string, () => void> = {};
  const on = jest.spyOn(process, 'on').mockImplementation(((
    event: string,
    callback: () => void,
  ) => {
    listeners[event] = callback;
    return process;
  }) as typeof process.on);
  const exit = jest
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never);
  try {
    shutdown(
      {
        get: () => new DrainState(),
        close: () => new Promise(() => undefined),
      } as unknown as INestApplication,
      {
        get: (key: string) => (key === 'SHUTDOWN_DRAIN_DELAY_MS' ? 0 : 10),
      } as unknown as ConfigService,
    );
    listeners.SIGTERM();
    jest.advanceTimersByTime(10);
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    jest.useRealTimers();
    on.mockRestore();
    exit.mockRestore();
  }
});

it('holds the listener open during the configured readiness drain window', async () => {
  jest.useFakeTimers();
  const listeners: Record<string, () => void> = {};
  jest.spyOn(process, 'on').mockImplementation(((
    event: string,
    callback: () => void,
  ) => {
    listeners[event] = callback;
    return process;
  }) as typeof process.on);
  const remove = jest.spyOn(process, 'removeListener').mockReturnValue(process);
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const close = jest.fn().mockResolvedValue(undefined);
  const drain = new DrainState();
  try {
    shutdown(
      { get: () => drain, close } as unknown as INestApplication,
      {
        get: (key: string) => (key === 'SHUTDOWN_DRAIN_DELAY_MS' ? 100 : 1000),
      } as unknown as ConfigService,
    );
    listeners.SIGTERM();
    expect(drain.draining).toBe(true);
    expect(close).not.toHaveBeenCalled();
    jest.advanceTimersByTime(99);
    expect(close).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('SIGTERM', listeners.SIGTERM);
    expect(remove).toHaveBeenCalledWith('SIGINT', listeners.SIGINT);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
    jest.restoreAllMocks();
  }
});
it('logs close rejection and sets a failing exit status while retaining the hard deadline', async () => {
  jest.useFakeTimers();
  const prior = process.exitCode;
  const listeners: Record<string, () => void> = {};
  jest.spyOn(process, 'on').mockImplementation(((
    event: string,
    callback: () => void,
  ) => {
    listeners[event] = callback;
    return process;
  }) as typeof process.on);
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  try {
    shutdown(
      {
        get: () => new DrainState(),
        close: () => Promise.reject(new Error('private-failure')),
      } as unknown as INestApplication,
      {
        get: (key: string) => (key === 'SHUTDOWN_DRAIN_DELAY_MS' ? 0 : 1000),
      } as unknown as ConfigService,
    );
    listeners.SIGTERM();
    await Promise.resolve();
    await Promise.resolve();
    expect(process.exitCode).toBe(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'shutdown.failed' }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain('private-failure');
    expect(jest.getTimerCount()).toBe(1);
  } finally {
    process.exitCode = prior;
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  }
});
