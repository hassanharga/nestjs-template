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

    let policy: IPolicy | undefined;

    descriptor.value = function (...args: unknown[]) {
      policy ??= buildPolicy(
        { ...options, name },
        ResilienceRegistry.getDefaults(),
        ResilienceRegistry.getObserver(),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return policy.execute(() => original.apply(this, args));
    };

    return descriptor;
  };
}
