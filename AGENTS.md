# AGENTS.md

This is the single source of repository instructions for all coding agents.
Update guidance here; CLAUDE.md imports this file. Read README.md for setup,
learnings.md for project lessons, and docs/ for capability-specific guidance.

## Stack

- **Framework:** NestJS v11 (Express adapter)
- **Language:** TypeScript 5.7 (CommonJS output, ES2023 target)
- **Package manager:** pnpm — do not use npm or yarn
- **Validation:** nestjs-zod v5 + Zod v4 — use `createZodDto`, never class-validator/class-transformer
- **Logging:** nestjs-pino — structured JSON, payload logging is opt-in; use `@Log()` decorator (`src/common/decorators/log.decorator.ts`) for method-level tracing
- **Result type:** neverthrow — services return `Result<T, E>`
- **Config:** Zod-validated schema in `src/common/config/config.schema.ts` — add all env vars there
- **API docs:** @nestjs/swagger — Swagger UI at `/api` (non-production only)

## Commands

```bash
pnpm run start:dev     # Development with watch mode
pnpm run build         # Compile to dist/ (production entry: dist/main.js)
pnpm run start:prod    # Run compiled output

pnpm run test          # Unit tests (Jest, pattern: src/**/*.spec.ts)
pnpm run test:e2e      # E2E tests (config: test/jest-e2e.json)
pnpm run test:cov      # Coverage report

pnpm run lint:check    # Read-only ESLint (src/, test/)
pnpm run lint          # ESLint with automatic fixes
pnpm run typecheck     # Check application and test types
pnpm run format:check  # Read-only Prettier check
pnpm run format        # Apply Prettier formatting
pnpm run template:init orders-api  # Name a fresh copy
pnpm run api:generate  # Build and export the business OpenAPI contract
pnpm run api:check     # Build and check contract drift without rewriting
pnpm run docker:up     # Start the core container
pnpm run docker:monitoring:up  # Start optional local monitoring
```

## Architecture

```text
src/
  main.ts              # Bootstrap: reflect-metadata, config, Swagger, shutdown
  main.config.ts       # Shared logger, Helmet, CORS, versioning, validation
  main.swagger.ts      # Business API documentation with cleanupOpenApiDoc
  main.shutdown.ts     # Signal handling, optional readiness dwell, close deadline
  app.module.ts        # Root imports and global filter/interceptor/guard
  features/
    api.modules.ts     # Business module registry shared with OpenAPI export
    example/           # Removable controller/service/DTO example
  openapi/             # Offline contract exporter
  common/
    config/            # Zod-validated configuration
    decorators/        # Method logging
    filters/           # Global exception handling
    health/            # Version-neutral liveness/readiness probes
    interceptors/      # Response envelopes and raw-response opt-out
    logger/            # Pino configuration and safe error diagnostics
    monitoring/        # Optional process, HTTP, and resilience metrics
    resilience/        # Optional upstream policies
```

Keep business code under src/features/<feature>. New modules follow the example:
module, controller, service, and DTOs using createZodDto. Keep transport DTOs and
HTTP exceptions at the boundary. Register business modules in API_MODULES.

## Code Style

Prettier config (`.prettierrc`):

- Single quotes; 2-space indentation
- Trailing commas: `"all"`

ESLint uses flat config (`eslint.config.mjs`) with TypeScript Project Service. Notable rule overrides:

- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-floating-promises`: warn
- `@typescript-eslint/no-unsafe-argument`: warn
- `no-console`: warn

## TypeScript

- `experimentalDecorators` and `emitDecoratorMetadata` are **required** — NestJS DI depends on them; do not disable.
- `reflect-metadata` must be imported at the top of `main.ts`.
- Build excludes spec files via `tsconfig.build.json`.

## Testing and verification

Verification order: `lint:check -> typecheck -> build -> focused tests`, plus
`format:check`. Lint catches issues that TypeScript does not. For a focused run:

```bash
pnpm test --runTestsByPath src/features/example/app.controller.spec.ts --runInBand --watchman=false
pnpm test:e2e --runTestsByPath test/app.e2e-spec.ts --runInBand --watchman=false
```

Full-suite execution requires explicit authorization during agent work. Use
bounded workers, explicit paths, and non-watch mode. Pre-commit runs read-only
lint, typecheck, and formatting checks. Report PASS, FAIL, BLOCKED, or NOT RUN
for the applicable checks.

- Unit tests live alongside source files in `src/` (`*.spec.ts`).
- E2E tests live in `test/` and use a separate Jest config (`test/jest-e2e.json`).
- Unit Jest config lives in `jest.config.ts` (root); E2E config in `test/jest-e2e.json`. Both transform `.ts` with `ts-jest` and `.js` with `@swc/jest`, and whitelist cockatiel in `transformIgnorePatterns` (cockatiel ships pure ESM, so it must be transformed for Jest's CommonJS runtime).

## Git Conventions

Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`.

## Key Gotchas

- Only `@nestjs/platform-express` is installed. Adding Fastify requires explicit installation and bootstrap changes.
- Nest CLI builds with TypeScript; `ts-jest` transforms TypeScript tests and
  `@swc/jest` transforms JavaScript tests. `@swc/core` is present in devDependencies
  but SWC is not configured as the application build compiler.
- Server port defaults to `3000`; override with the `PORT` environment variable.
- `.env.example` is tracked; `.env` and local overrides are ignored.
- **nestjs-zod v5** has no `patchNestJsSwagger` — Swagger integration is automatic; `cleanupOpenApiDoc` in `main.swagger.ts` is the only required hook.
- **Swagger examples:** use `.meta({ example: value })` (singular) on Zod fields. `examples` (plural array) is JSON Schema and is ignored by Swagger UI's "Example Value" display.
- When using neverthrow, always handle Results with the `match()` pattern; never use `_unsafeUnwrap()` or other unsafe workarounds for TypeScript narrowing.

## HTTP contracts

- API versioning defaults to URI v1; infrastructure controllers are version-neutral.
- Global prefix is optional; use configureApplication in main.config.ts for shared
  bootstrap, export, and HTTP-test setup.
- Use @RawResponse() for explicit raw endpoint contracts. Health, metrics,
  already-sent responses, buffers, and streams bypass the response envelope.
- Core Compose starts only the API. docker:monitoring:up enables the optional stack.

## Template boundaries

Use Node 26.13.0 and pnpm 12.16.1. The example lives in src/features/example and can be removed as one module. Shared configureApplication setup is used in bootstrap and HTTP tests. API routes default to /v1; health and optional metrics are version-neutral. Monitoring/resilience default off; read docs/capabilities.md before changing their imports. Check lint:check, typecheck, format:check, build, and directly affected tests. Do not install dependencies without authorization.

## Logging and module lifecycle

Read docs/logging.md. HTTP logs omit raw URL/query/headers/body; correlation IDs are validated and echoed. Use structured curated fields. LOG_LEVEL includes fatal/silent; development prettifies, production is JSON. Monitoring has a DI-owned MetricsRegistry per app; do not register collectors globally. AppModule combination tests cover optional modules independently and together.

## Generated contract

Register business modules in src/features/api.modules.ts (API_MODULES), shared
by AppModule and the offline exporter. Run pnpm api:generate after API changes
and pnpm api:check to detect drift. See docs/api-generation.md. Production
builds disable incremental emission so repeated clean builds remain complete.
