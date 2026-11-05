import { Logger } from '@nestjs/common';

export interface LogOptions {
  args?: boolean;
  result?: boolean;
}

const sensitiveKey =
  /password|passwd|secret|token|authorization|cookie|api[-_]?key/i;

function trySerialize(value: unknown): string {
  const seen = new WeakSet<object>();
  let remaining = 100;
  function sanitize(input: unknown, depth: number): unknown {
    if (typeof input === 'string') return input.slice(0, 256);
    if (typeof input === 'bigint') return String(input);
    if (input === null || typeof input !== 'object') return input;
    if (depth >= 4 || remaining-- <= 0) return '[Truncated]';
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input))
      return input.slice(0, 20).map((entry) => sanitize(entry, depth + 1));
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(input).slice(0, 20)) {
      // Do not invoke getters or custom toJSON methods while logging.
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      result[key] = sensitiveKey.test(key)
        ? '[Redacted]'
        : descriptor && 'value' in descriptor
          ? sanitize(descriptor.value, depth + 1)
          : '[Accessor]';
    }
    return result;
  }
  try {
    return JSON.stringify(sanitize(value, 0))?.slice(0, 2048) ?? '[Undefined]';
  } catch {
    return '[Unserializable]';
  }
}

export function Log(options: LogOptions = {}): MethodDecorator {
  const { args = false, result = false } = options;

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
      logger.log({
        event: 'method.called',
        method: methodName,
        ...(args && callArgs.length ? { args: trySerialize(callArgs) } : {}),
      });
      const start = performance.now();
      const durationMs = () => Math.round(performance.now() - start);
      const failed = () =>
        logger.error({
          event: 'method.failed',
          method: methodName,
          durationMs: durationMs(),
        });
      const completed = (value: unknown) => {
        logger.log({
          event: 'method.completed',
          method: methodName,
          durationMs: durationMs(),
          ...(result ? { result: trySerialize(value) } : {}),
        });
        return value;
      };
      let returnValue: unknown;
      try {
        returnValue = original.apply(this, callArgs);
      } catch (error) {
        failed();
        throw error;
      }
      if (returnValue instanceof Promise) {
        return returnValue.then(completed, (error: unknown) => {
          failed();
          throw error;
        });
      }
      return completed(returnValue);
    };
    return descriptor;
  };
}
