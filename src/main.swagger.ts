import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

const serviceMetadata = {
  name: 'BE Template',
  description: 'BE Template',
  repoUrl: 'https://github.com/',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createLink = (url: string, label: string) =>
  `<a target="_blank" href="${url}">${label}</a>`;

const ENV_COLORS: Record<string, string> = {
  local: '🟢',
  development: '🔵',
  staging: '🟡',
  qa: '🟠',
  production: '🔴',
};

const createEnv = (label: string) => {
  return `${ENV_COLORS[label] || '⚪'} ${label}`;
};

export default function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
) {
  const appVersion = configService.get<string>('APP_VERSION', '1.0.0');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  const swaggerDescription = `${serviceMetadata.description}`;

  const swaggerConfig = new DocumentBuilder()
    .setTitle(serviceMetadata.name)
    .setDescription(swaggerDescription)
    .setVersion(`${appVersion} ${createEnv(nodeEnv)}`)
    .addBearerAuth();

  const document = SwaggerModule.createDocument(app, swaggerConfig.build(), {
    extraModels: [],
  });

  SwaggerModule.setup('api', app, cleanupOpenApiDoc(document), {
    /**
     * Custom Swagger UI Enhancer: Scroll and Highlight Target Model
     *
     * This script enhances the Swagger UI experience by allowing users to scroll directly to a
     * specific schema model in the "Schemas" section via a URL query parameter.
     *
     * Usage:
     *   Append `?scrollTo=ModelName` to the Swagger UI URL. Example:
     *   → http://localhost:3000/api?scrollTo=SaveCurrentLocationMessage
     *
     * Behavior:
     * - Locates the DOM element with ID `model-<ModelName>` (e.g., `model-SaveCurrentLocationMessage`)
     * - Scrolls to that element smoothly once Swagger UI finishes rendering
     * - Expands the model if it is collapsed
     * - Permanently highlights the model's container with a background color to make it visually stand out
     *
     * Notes:
     * - The highlight is applied via a custom CSS class and will persist until page reload or navigation.
     * - This script is injected using NestJS's SwaggerModule `customJsStr` option.
     */

    customJsStr: `
  window.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const modelName = params.get('scrollTo');
    if (!modelName) return;

    const elementId = 'model-' + modelName;
    const highlightClass = 'swagger-model-highlight';

    // Inject highlight CSS
    const style = document.createElement('style');
    style.innerHTML = \`
      .\${highlightClass} {
        background-color: #ffffcc !important;
        transition: background-color 0.5s ease;
      }
    \`;
    document.head.appendChild(style);

    const tryScroll = () => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const toggle = el.querySelector('.model-box-control');
        if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
          toggle.click();
        }

        // Add persistent highlight
        el.classList.add(highlightClass);
      } else {
        setTimeout(tryScroll, 300);
      }
    };

    tryScroll();
  });
`,
  });
}
