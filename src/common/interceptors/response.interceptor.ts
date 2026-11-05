import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Readable } from 'node:stream';
import { RAW_RESPONSE, isInfrastructurePath } from './raw-response.decorator';
import { Response } from 'express';
import { Err, Ok } from 'neverthrow';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ path: string }>();
    if (
      isInfrastructurePath(req.path) ||
      (context.getHandler &&
        this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
          context.getHandler(),
          context.getClass(),
        ]))
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        if (data instanceof Err) throw data.error as unknown;
        const value: unknown =
          data instanceof Ok ? (data.value as unknown) : data;

        const res = context.switchToHttp().getResponse<Response>();
        if (
          res.statusCode === 204 ||
          res.headersSent ||
          value instanceof StreamableFile ||
          value instanceof Readable ||
          Buffer.isBuffer(value)
        )
          return value;
        return {
          status: res.statusCode,
          success: true,
          data: value ?? null,
          error: null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
