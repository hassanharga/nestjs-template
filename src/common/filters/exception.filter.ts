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
import { Response } from 'express';
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
    const response = ctx.getResponse<Response>();

    let status: number;
    let code: string;
    let message: string;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
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
          ? exception.message
          : 'Internal server error';
      stack = exception instanceof Error ? exception.stack : undefined;
    }

    this.logger.error(stack);

    response.status(status).json({
      status,
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(this.isNotProduction && stack !== undefined && { stack }),
      },
      timestamp: new Date().toISOString(),
    });
  }
}
