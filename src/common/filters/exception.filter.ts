import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { safeError, validatedRequestId } from '../logger/logger.options';
import { isInfrastructurePath } from '../interceptors/raw-response.decorator';
import { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { AppConfig } from '../config/config.schema';

function codeFromStatus(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
    503: 'SERVICE_UNAVAILABLE',
  };
  return map[status] ?? 'HTTP_ERROR';
}

@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isNotProduction: boolean;

  constructor(private readonly config: ConfigService<AppConfig>) {
    this.isNotProduction =
      this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<{ path?: string; id?: string | number }>();
    const requestId = validatedRequestId(request.id);
    const response = ctx.getResponse<Response>();
    request.id = requestId;
    if (!response.headersSent) response.setHeader?.('x-request-id', requestId);

    let status: number;
    let code: string;
    let message: string;
    let stack: string | undefined;
    let errors: unknown[] | undefined;

    if (exception instanceof ZodValidationException) {
      status = exception.getStatus();
      code = 'VALIDATION_ERROR';
      const body = exception.getResponse() as Record<string, unknown>;
      message = (body.message as string) ?? 'Validation failed';
      errors = Array.isArray(body.errors) ? body.errors : undefined;
      stack = exception.stack;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        code = codeFromStatus(status);
        message = body;
      } else {
        const bodyObj = body as Record<string, unknown>;
        code = (bodyObj.code as string) ?? codeFromStatus(status);
        const rawMessage = bodyObj.message;
        message = Array.isArray(rawMessage)
          ? rawMessage.join('; ')
          : ((rawMessage as string) ?? exception.message);
      }
      stack = exception.stack;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message =
        exception instanceof Error
          ? this.isNotProduction
            ? exception.message
            : 'Internal server error'
          : 'Internal server error';
      stack = exception instanceof Error ? exception.stack : undefined;
    }

    if (status >= 500)
      this.logger.error({
        event: 'http.exception',
        requestId,
        status,
        code,
        error: safeError(exception),
      });
    else this.logger.warn({ event: 'http.exception', requestId, status, code });

    if (isInfrastructurePath(request.path)) {
      response
        .status(status)
        .json(
          exception instanceof HttpException
            ? exception.getResponse()
            : { statusCode: status, message },
        );
      return;
    }

    response.status(status).json({
      status,
      requestId,
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(errors && { errors }),
        ...(this.isNotProduction && stack !== undefined && { stack }),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
