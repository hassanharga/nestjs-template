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
    expect(timeouts.inc).toHaveBeenCalledWith({ policy: 'svc.call' });
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
