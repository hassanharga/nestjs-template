import { HttpException } from '@nestjs/common';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './app.error';

describe('AppError', () => {
  it('stores code, message, httpStatus, and sets name to class name', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    expect(err.code).toBe('MY_CODE');
    expect(err.message).toBe('my message');
    expect(err.httpStatus).toBe(418);
    expect(err.name).toBe('AppError');
  });

  it('throw() raises HttpException with the correct status', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    expect(() => err.throw()).toThrow(HttpException);
  });

  it('throw() puts code and message in the HttpException body', () => {
    const err = new AppError('MY_CODE', 'my message', 418);
    try {
      err.throw();
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(418);
      expect((e as HttpException).getResponse()).toEqual({
        code: 'MY_CODE',
        message: 'my message',
      });
    }
  });
});

describe('NotFoundError', () => {
  it('has code NOT_FOUND and status 404', () => {
    const err = new NotFoundError('User not found');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.httpStatus).toBe(404);
    expect(err.message).toBe('User not found');
  });

  it('uses default message when none provided', () => {
    expect(new NotFoundError().message).toBe('Not found');
  });
});

describe('ValidationError', () => {
  it('has code VALIDATION_ERROR and status 422', () => {
    const err = new ValidationError();
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.httpStatus).toBe(422);
  });
});

describe('UnauthorizedError', () => {
  it('has code UNAUTHORIZED and status 401', () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.httpStatus).toBe(401);
  });
});

describe('ForbiddenError', () => {
  it('has code FORBIDDEN and status 403', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe('FORBIDDEN');
    expect(err.httpStatus).toBe(403);
  });
});

describe('ConflictError', () => {
  it('has code CONFLICT and status 409', () => {
    const err = new ConflictError();
    expect(err.code).toBe('CONFLICT');
    expect(err.httpStatus).toBe(409);
  });
});
