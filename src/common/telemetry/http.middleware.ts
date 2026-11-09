import { Request, Response, NextFunction } from 'express';
import { telemetryRuntime } from './bridge';

export function telemetryHttp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const runtime = telemetryRuntime();
  if (
    !runtime ||
    req.path.startsWith('/health/') ||
    req.path === '/metrics' ||
    req.path === '/api' ||
    req.path === '/api-json' ||
    req.path === '/api-yaml' ||
    req.path.startsWith('/api/swagger-ui') ||
    req.path.startsWith('/api/favicon')
  ) {
    next();
    return;
  }
  const carrier =
    typeof req.headers.traceparent === 'string'
      ? req.headers.traceparent
      : undefined;
  const span = runtime.server(carrier);
  const finish = () => span.end(res.writableFinished ? res.statusCode : 499);
  res.once('finish', finish);
  res.once('close', finish);
  span.run(next);
}
