import { HttpExceptionFilter } from './http-exception.filter';
import { NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';

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

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('returns 404 with correct shape for NotFoundException', () => {
    const { host, json, status } = buildHost('/api/users/99');

    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'User not found',
        path: '/api/users/99',
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('returns 401 for UnauthorizedException', () => {
    const { host, status } = buildHost('/api/secret');
    filter.catch(new UnauthorizedException(), host);
    expect(status).toHaveBeenCalledWith(401);
  });

  it('returns 400 for BadRequestException', () => {
    const { host, status } = buildHost('/api/submit');
    filter.catch(new BadRequestException('Validation failed'), host);
    expect(status).toHaveBeenCalledWith(400);
  });
});
