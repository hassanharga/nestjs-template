import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('uses x-request-id header when present', () => {
    const req = { headers: { 'x-request-id': 'my-trace-id' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toBe('my-trace-id');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'my-trace-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID when x-request-id header is absent', () => {
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', req.id);
    expect(next).toHaveBeenCalled();
  });

  it('generates a different UUID for each request', () => {
    const req1 = { headers: {} } as any;
    const req2 = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    middleware.use(req1, res, jest.fn());
    middleware.use(req2, res, jest.fn());

    expect(req1.id).not.toBe(req2.id);
  });
});
