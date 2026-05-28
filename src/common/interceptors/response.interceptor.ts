import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ path: string }>();
    if (req.path === '/metrics') {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const res = context.switchToHttp().getResponse<Response>();
        return {
          status: res.statusCode,
          success: true,
          data: data ?? null,
          error: null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
