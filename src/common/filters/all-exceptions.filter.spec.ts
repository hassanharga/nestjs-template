import { AllExceptionsFilter } from './all-exceptions.filter';

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

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter(mockConfig());
  });

  it('returns 500 for an unknown Error', () => {
    const { host, json, status } = buildHost('/api/boom');

    filter.catch(new Error('Something exploded'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
        path: '/api/boom',
      }),
    );
    expect(json.mock.calls[0][0]).toHaveProperty('timestamp');
  });

  it('returns 500 for a thrown string', () => {
    const { host, status } = buildHost('/api/boom');
    filter.catch('something broke', host);
    expect(status).toHaveBeenCalledWith(500);
  });
});
