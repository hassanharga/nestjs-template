import { safeError } from './common/logger/logger.options';
export function bootstrapFailureRecord(error: unknown) {
  return { level: 50, event: 'app.bootstrap.failed', error: safeError(error) };
}
