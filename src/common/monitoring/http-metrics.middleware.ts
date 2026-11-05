import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly counter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === '/metrics') {
      next();
      return;
    }
    const end = this.histogram.startTimer();
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      const route = req.route as { path?: unknown } | undefined;
      const labels = {
        method: req.method,
        path: typeof route?.path === 'string' ? route.path : 'unmatched',
        status_code: String(res.writableFinished ? res.statusCode : 499),
      };
      this.counter.inc(labels);
      end(labels);
    };
    res.once('finish', record);
    res.once('close', record);
    next();
  }
}
