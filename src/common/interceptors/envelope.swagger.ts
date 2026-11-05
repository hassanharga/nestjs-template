import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

export function ApiEnvelope(
  status: number,
  model: Type<unknown> | { type: 'string'; example?: string },
) {
  return applyDecorators(
    ...(typeof model === 'function' ? [ApiExtraModels(model)] : []),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        required: ['status', 'success', 'data', 'error', 'timestamp'],
        properties: {
          status: { type: 'integer', enum: [status], example: status },
          success: { type: 'boolean', enum: [true], example: true },
          data:
            typeof model === 'function'
              ? { $ref: getSchemaPath(model) }
              : model,
          error: {
            type: 'object',
            nullable: true,
            enum: [null],
            example: null,
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    }),
  );
}

export function ApiErrorEnvelope(status: number) {
  return ApiResponse({
    status,
    schema: {
      type: 'object',
      required: [
        'status',
        'success',
        'data',
        'error',
        'requestId',
        'timestamp',
      ],
      properties: {
        status: { type: 'integer', enum: [status], example: status },
        success: { type: 'boolean', enum: [false], example: false },
        data: { type: 'object', nullable: true, enum: [null], example: null },
        requestId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
        error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
            stack: { type: 'string' },
          },
        },
      },
    },
  });
}
