import { EventEmitter } from 'node:events';
import {
  IDefaultPolicyContext,
  IPolicy,
  timeout,
  TimeoutStrategy,
} from 'cockatiel';

/** Each execution owns its timer and parent signal, including concurrent calls. */
export class ObservedTimeoutPolicy implements IPolicy {
  declare readonly _altReturn: never;
  private readonly events = new EventEmitter();
  readonly onSuccess: IPolicy['onSuccess'] = (listener) => {
    this.events.on('success', listener);
    return {
      dispose: () => {
        this.events.off('success', listener);
      },
    };
  };
  readonly onFailure: IPolicy['onFailure'] = (listener) => {
    this.events.on('failure', listener);
    return {
      dispose: () => {
        this.events.off('failure', listener);
      },
    };
  };
  constructor(
    private readonly ms: number,
    private readonly report: () => void,
  ) {}
  execute<T>(
    fn: (context: IDefaultPolicyContext) => PromiseLike<T> | T,
    signal?: AbortSignal,
  ): Promise<T> {
    const policy = timeout(this.ms, TimeoutStrategy.Aggressive);
    const subscriptions = [
      policy.onTimeout(() => {
        if (!signal?.aborted) this.report();
      }),
      policy.onSuccess((event) => {
        this.events.emit('success', event);
      }),
      policy.onFailure((event) => {
        this.events.emit('failure', event);
      }),
    ];
    return policy.execute(fn, signal).finally(() => {
      for (const subscription of subscriptions) subscription.dispose();
    });
  }
}
