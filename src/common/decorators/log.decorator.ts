import { Logger } from '@nestjs/common';

export interface LogOptions {
  args?: boolean;
  result?: boolean;
  level?: 'log' | 'debug' | 'verbose';
}

export function Log(options: LogOptions = {}): MethodDecorator {
  const { args = true, result = true, level = 'log' } = options;

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const className = (target as { constructor: { name: string } }).constructor
      .name;
    const methodName = String(propertyKey);
    const logger = new Logger(className);
    const original = descriptor.value as (...a: unknown[]) => unknown;

    descriptor.value = function (...callArgs: unknown[]) {
      if (args) {
        logger[level](`[${methodName}] called`, callArgs);
      } else {
        logger[level](`[${methodName}] called`);
      }

      const start = Date.now();

      let returnValue: unknown;
      try {
        returnValue = original.apply(this, callArgs);
      } catch (err) {
        const duration = Date.now() - start;
        logger.error(
          `[${methodName}] failed in ${duration}ms`,
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }

      if (returnValue instanceof Promise) {
        return returnValue.then(
          (res) => {
            const duration = Date.now() - start;
            if (result) {
              logger[level](`[${methodName}] completed in ${duration}ms`, res);
            } else {
              logger[level](`[${methodName}] completed in ${duration}ms`);
            }
            return res;
          },
          (err: unknown) => {
            const duration = Date.now() - start;
            logger.error(
              `[${methodName}] failed in ${duration}ms`,
              err instanceof Error ? err.message : String(err),
            );
            throw err;
          },
        );
      }

      const duration = Date.now() - start;
      if (result) {
        logger[level](`[${methodName}] completed in ${duration}ms`, returnValue);
      } else {
        logger[level](`[${methodName}] completed in ${duration}ms`);
      }
      return returnValue;
    };

    return descriptor;
  };
}
