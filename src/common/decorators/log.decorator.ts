/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Logger } from '@nestjs/common';

export interface LogOptions {
  args?: boolean;
  result?: boolean;
  // level?: 'log' | 'debug' | 'verbose';
}

function trySerialize(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function Log(options: LogOptions = {}): MethodDecorator {
  const { args = true, result = true } = options;

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
      const argsStr =
        args && callArgs.length ? ` args=${trySerialize(callArgs)}` : '';
      logger.log(`[${methodName}] called${argsStr}`);

      const start = Date.now();

      let returnValue: unknown;
      try {
        returnValue = original.apply(this, callArgs);
      } catch (err) {
        const duration = Date.now() - start;
        logger.error(
          `[${methodName}] failed in ${duration}ms: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      }

      if (returnValue instanceof Promise) {
        return returnValue.then(
          (res) => {
            const duration = Date.now() - start;
            const resultStr = result ? ` result=${trySerialize(res)}` : '';
            logger.log(
              `[${methodName}] completed in ${duration}ms${resultStr}`,
            );
            return res;
          },
          (err: unknown) => {
            const duration = Date.now() - start;
            logger.error(
              `[${methodName}] failed in ${duration}ms: ${err instanceof Error ? err.message : String(err)}`,
            );
            throw err;
          },
        );
      }
      const duration = Date.now() - start;
      const resultStr = result ? ` result=${trySerialize(returnValue)}` : '';
      logger.log(`[${methodName}] completed in ${duration}ms${resultStr}`);
      return returnValue;
    };

    return descriptor;
  };
}
