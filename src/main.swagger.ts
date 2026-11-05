import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { API_MODULES } from './features/api.modules';

export function createApiDocument(
  app: INestApplication,
  config: ConfigService,
) {
  const builder = new DocumentBuilder()
    .setTitle(config.get<string>('APP_NAME', 'nestjs-app'))
    .setDescription(config.get<string>('APP_DESCRIPTION', 'Application API'))
    .setVersion(config.get<string>('APP_VERSION', '0.0.1'));
  const repositoryUrl = config.get<string>('APP_REPOSITORY_URL');
  if (repositoryUrl) builder.setExternalDoc('Source repository', repositoryUrl);

  return cleanupOpenApiDoc(
    SwaggerModule.createDocument(app, builder.build(), {
      include: API_MODULES,
      deepScanRoutes: true,
    }),
  );
}

export default function setupSwagger(
  app: INestApplication,
  config: ConfigService,
) {
  SwaggerModule.setup('api', app, createApiDocument(app, config));
}
