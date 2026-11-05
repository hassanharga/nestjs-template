import { Logger } from '@nestjs/common';
import { ResilienceObserver } from './resilience.observer';
import { BreakerStateValue } from './resilience.constants';
import { Counter, Gauge } from 'prom-client';

function fakeCounter(): Counter<string> & { inc: jest.Mock } {
  return { inc: jest.fn() } as Counter<string> & { inc: jest.Mock };
}

function fakeGauge(): Gauge<string> & { set: jest.Mock } {
  return { set: jest.fn() } as Gauge<string> & { set: jest.Mock };
}

describe('ResilienceObserver', () => {
  let retries: ReturnType<typeof fakeCounter>;
  let timeouts: ReturnType<typeof fakeCounter>;
  let breakerEvents: ReturnType<typeof fakeCounter>;
  let bulkheadRejections: ReturnType<typeof fakeCounter>;
  let breakerState: ReturnType<typeof fakeGauge>;
  let observer: ResilienceObserver;

  beforeEach(() => {
    retries = fakeCounter();
    timeouts = fakeCounter();
    breakerEvents = fakeCounter();
    bulkheadRejections = fakeCounter();
    breakerState = fakeGauge();
    observer = new ResilienceObserver(
      retries,
      timeouts,
      breakerEvents,
      bulkheadRejections,
      breakerState,
    );
  });

  it('records a retry', () => {
    observer.recordRetry('svc.call');
    expect(retries.inc).toHaveBeenCalledWith({ policy: 'svc.call' });
  });

  it('records a timeout', () => {
    observer.recordTimeout('svc.call');
    expect(timeouts.inc).toHaveBeenCalledWith({
      policy: 'svc.call',
      kind: 'attempt',
    });
  });

  it('records a bulkhead rejection', () => {
    observer.recordBulkheadRejection('svc.call');
    expect(bulkheadRejections.inc).toHaveBeenCalledWith({
      policy: 'svc.call',
    });
  });

  it('records breaker open: event counter + gauge', () => {
    observer.recordBreakerOpen('svc.call');
    expect(breakerEvents.inc).toHaveBeenCalledWith({
      policy: 'svc.call',
      event: 'open',
    });
    expect(breakerState.set).toHaveBeenCalledWith(
      { policy: 'svc.call' },
      BreakerStateValue.Open,
    );
  });

  it('records breaker half-open', () => {
    observer.recordBreakerHalfOpen('svc.call');
    expect(breakerEvents.inc).toHaveBeenCalledWith({
      policy: 'svc.call',
      event: 'half_open',
    });
    expect(breakerState.set).toHaveBeenCalledWith(
      { policy: 'svc.call' },
      BreakerStateValue.HalfOpen,
    );
  });

  it('records breaker close', () => {
    observer.recordBreakerClose('svc.call');
    expect(breakerEvents.inc).toHaveBeenCalledWith({
      policy: 'svc.call',
      event: 'close',
    });
    expect(breakerState.set).toHaveBeenCalledWith(
      { policy: 'svc.call' },
      BreakerStateValue.Closed,
    );
  });
});

it('emits stable structured resilience events without interpolated policies', () => {
  const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  const observer = new ResilienceObserver(
    undefined!,
    undefined!,
    undefined!,
    undefined!,
    undefined!,
  );
  try {
    observer.recordRetry('svc.call');
    observer.recordTimeout('svc.call');
    observer.recordBulkheadRejection('svc.call');
    observer.recordBreakerOpen('svc.call');
    observer.recordBreakerHalfOpen('svc.call');
    observer.recordBreakerClose('svc.call');
    expect(debug).toHaveBeenCalledWith({
      event: 'resilience.retry',
      policy: 'svc.call',
    });
    expect(warn.mock.calls.map(([event]) => event as unknown)).toEqual([
      { event: 'resilience.timeout', policy: 'svc.call', kind: 'attempt' },
      { event: 'resilience.bulkhead.rejected', policy: 'svc.call' },
      { event: 'resilience.circuit.open', policy: 'svc.call' },
    ]);
    expect(log.mock.calls.map(([event]) => event as unknown)).toEqual([
      { event: 'resilience.circuit.half_open', policy: 'svc.call' },
      { event: 'resilience.circuit.closed', policy: 'svc.call' },
    ]);
  } finally {
    jest.restoreAllMocks();
  }
});
