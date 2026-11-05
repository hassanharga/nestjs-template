import { IPolicy } from 'cockatiel';
import { buildPolicy } from './resilience.factory';
import { ResilienceRegistry } from './resilience.registry';
import { ResilienceOptions } from './resilience.types';

export function Resilience(options: ResilienceOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const className = (target as { constructor: { name: string } }).constructor
      .name;
    const name = options.name ?? `${className}.${String(propertyKey)}`;
    const original = descriptor.value as (...args: unknown[]) => unknown;

    const policies = new WeakMap<object, IPolicy>();

    descriptor.value = function (this: object, ...args: unknown[]) {
      let policy = policies.get(this);
      if (!policy) {
        policy = buildPolicy(
          { ...options, name },
          new ResilienceRegistry().defaults,
        );
        policies.set(this, policy);
      }
      const signal =
        args.at(-1) instanceof AbortSignal
          ? (args.pop() as AbortSignal)
          : undefined;
      return policy.execute(
        (context): unknown =>
          original.apply(this, [...args, context]) as unknown,
        signal,
      );
    };

    return descriptor;
  };
}
