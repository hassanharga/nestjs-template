import {
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { GlobalExceptionFilter } from './exception.filter';

function mockConfig(nodeEnv = 'test') {
  return {
    get: jest.fn((key: string, def?: string) =>
      key === 'NODE_ENV' ? nodeEnv : def,
    ),
  } as any;
}

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
      }),
    } as any,
    json,
    status,
  };
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;

  beforeEach(() => {
    filter = new GlobalExceptionFilter(mockConfig());
  });

  it('formats HttpException with explicit code in body', () => {
    const { host, json, status } = buildHost();
    const exception = new HttpException(
      { code: 'NOT_FOUND', message: 'User not found' },
      404,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        success: false,
        data: null,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'User not found',
        }),
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('formats NestJS NotFoundException with derived code', () => {
    const { host, json, status } = buildHost();

    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 404,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'User not found',
      }),
    });
  });

  it('formats NestJS UnauthorizedException', () => {
    const { host, status } = buildHost();
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('formats unknown Error as 500 INTERNAL_SERVER_ERROR', () => {
    const { host, json, status } = buildHost();

    filter.catch(new Error('Something exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 500,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something exploded',
      }),
    });
  });

  it('formats thrown non-Error as 500', () => {
    const { host, status } = buildHost();
    filter.catch('something broke', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('includes stack in error in non-production', () => {
    const { host, json } = buildHost();
    filter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).toHaveProperty('stack');
  });

  it('omits stack in production', () => {
    const prodFilter = new GlobalExceptionFilter(mockConfig('production'));
    const { host, json } = buildHost();
    prodFilter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).not.toHaveProperty('stack');
  });

  it('formats ZodValidationException with VALIDATION_ERROR code and issues', () => {
    const { host, json, status } = buildHost();
    const zodError = {
      issues: [
        { path: ['name'], message: 'Required', code: 'invalid_type' },
        { path: ['age'], message: 'Expected number', code: 'invalid_type' },
      ],
    };
    filter.catch(new ZodValidationException(zodError), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 400,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: zodError.issues,
      }),
    });
  });

  it('joins array message from HttpException body into a string', () => {
    const { host, json } = buildHost();
    const exception = new HttpException(
      { message: ['field is required', 'must be a string'] },
      400,
    );
    filter.catch(exception, host);
    expect(json.mock.calls[0][0].error.message).toBe(
      'field is required; must be a string',
    );
  });
});
