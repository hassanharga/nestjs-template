import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureApplication } from './main.config';

it('installs the injected logger, credentialed CORS allowlist, versioning and validation', () => {
  const logger = {};
  const app = {
    get: jest.fn(() => logger),
    useLogger: jest.fn(),
    use: jest.fn(),
    enableCors: jest.fn(),
    enableVersioning: jest.fn(),
    useGlobalPipes: jest.fn(),
  };
  const config = {
    get: (key: string, fallback?: unknown) =>
      ({
        CORS_ORIGINS: 'https://one.example,https://two.example',
        CORS_CREDENTIALS: true,
      })[key] ?? fallback,
  } as ConfigService;
  configureApplication(app as unknown as INestApplication, config);
  expect(app.useLogger).toHaveBeenCalledWith(logger);
  expect(app.enableCors).toHaveBeenCalledWith({
    origin: ['https://one.example', 'https://two.example'],
    credentials: true,
  });
  expect(app.enableVersioning).toHaveBeenCalledWith({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
});
