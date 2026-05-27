import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly counter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly histogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const endTimer = this.histogram.startTimer({
      method: req.method,
      path: req.path,
    });

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const labels = {
          method: req.method,
          path: req.path,
          status_code: String(res.statusCode),
        };
        this.counter.inc(labels);
        endTimer(labels);
      }),
    );
  }
}
