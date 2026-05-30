# AGENTS.md

Compact guide for AI agents working in this repo.

## Commands

```bash
pnpm run start:dev          # Dev server with watch
pnpm run build              # Compile to dist/
pnpm run test               # Unit tests (src/**/*.spec.ts)
pnpm run test:e2e           # E2E tests (test/**/*.e2e-spec.ts)
pnpm run test -- path.spec  # Run a single test file
pnpm run lint               # ESLint with --fix
pnpm run format             # Prettier
```

Pre-commit hook runs: `pnpm test && pnpm lint && pnpm format`

Package manager is **pnpm** only — never use npm or yarn.

## Verification order

`lint -> build -> test` (lint catches issues tsc won't)

## Stack & conventions

- **NestJS v11** with Express adapter, TypeScript (CommonJS output, ES2023 target)
- **Validation:** nestjs-zod v5 + Zod v4 — always use `createZodDto`, never class-validator
- **Result type:** neverthrow — services return `Result<T, E>`
- **Logging:** nestjs-pino with `@Log()` decorator (`src/common/decorators/log.decorator.ts`)
- **Config:** all env vars must be added to the Zod schema at `src/common/config/config.schema.ts` (includes `'test'` in NODE_ENV enum)
- **Swagger:** UI at `/api` (dev only). Use `.meta({ example: value })` for examples (not `.examples()`)

## Architecture

```
src/
  main.ts              # Bootstrap — reflect-metadata, config, swagger, shutdown
  main.config.ts       # Helmet, CORS, versioning, ZodValidationPipe
  main.swagger.ts      # Swagger setup with cleanupOpenApiDoc
  main.shutdown.ts     # Graceful shutdown hooks
  app.module.ts        # Root module — registers global filter/interceptor/guard
  app.controller.ts    # Example controller
  app.service.ts       # Example service
  app.dto.ts           # Example DTOs
  common/
    config/            # Zod-validated config schema + module
    decorators/        # @Log() decorator
    filters/           # Global exception filter
    health/            # Health endpoints (/health/live, /health/ready)
    interceptors/      # Response-wrapping interceptor
    logger/            # Pino logger module
    monitoring/        # Prometheus metrics (/metrics)
```

New modules should follow the same pattern: module file, controller, service, DTOs with `createZodDto`.

## Gotchas

- `experimentalDecorators` and `emitDecoratorMetadata` are required — never disable them
- `reflect-metadata` must be the first import in `main.ts`
- `@swc/core` is in devDeps but not wired into the build — `ts-jest` is the test transformer
- API versioning is enabled (URI type) — routes are versioned automatically
- Global API prefix is commented out in `main.config.ts` — enable before adding real routes
- Response interceptor wraps all responses — bypass `/health/*` and `/metrics` if adding new infrastructure paths
- Docker Compose includes monitoring stack (Prometheus, Grafana, Loki, Alloy) — use `pnpm run docker:up`
- `.env.example` exists; `.env` is gitignored

## Style

- Prettier: single quotes, trailing commas `"all"`, 2-space indent
- ESLint: `no-explicit-any` off, `no-floating-promises` warn, `no-console` warn
- Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`
