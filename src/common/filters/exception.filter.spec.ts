import {
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GlobalExceptionFilter } from './exception.filter';

function mockConfig(nodeEnv = 'test') {
  return {
    get: jest.fn((key: string, def?: string) =>
      key === 'NODE_ENV' ? nodeEnv : def,
    ),
  } as any;
}

function buildHost(url: string) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    host: {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
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

  it('formats AppError-sourced HttpException with its code', () => {
    const { host, json, status } = buildHost('/api/users/99');
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
    const { host, json, status } = buildHost('/api/users/99');

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
    const { host, status } = buildHost('/api/secret');
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('formats unknown Error as 500 INTERNAL_SERVER_ERROR', () => {
    const { host, json, status } = buildHost('/api/boom');

    filter.catch(new Error('Something exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0]).toMatchObject({
      status: 500,
      success: false,
      data: null,
      error: expect.objectContaining({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    });
  });

  it('formats thrown non-Error as 500', () => {
    const { host, status } = buildHost('/api/boom');
    filter.catch('something broke', host);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('includes stack in error in non-production', () => {
    const { host, json } = buildHost('/api/boom');
    filter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).toHaveProperty('stack');
  });

  it('omits stack in production', () => {
    const prodFilter = new GlobalExceptionFilter(mockConfig('production'));
    const { host, json } = buildHost('/api/boom');
    prodFilter.catch(new Error('Boom'), host);
    expect(json.mock.calls[0][0].error).not.toHaveProperty('stack');
  });

  it('joins array message from HttpException body into a string', () => {
    const { host, json } = buildHost('/api/submit');
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
