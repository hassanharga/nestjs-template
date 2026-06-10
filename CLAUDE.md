# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Framework:** NestJS v11 (Express adapter)
- **Language:** TypeScript 5.7 (CommonJS output, ES2023 target)
- **Package manager:** pnpm — do not use npm or yarn
- **Validation:** nestjs-zod v5 + Zod v4 — use `createZodDto`, never class-validator/class-transformer
- **Logging:** nestjs-pino — structured JSON, use `@Log()` decorator (`src/common/decorators/log.decorator.ts`) for method-level tracing
- **Result type:** neverthrow — services return `Result<T, E>`
- **Config:** Zod-validated schema in `src/common/config/config.schema.ts` — add all env vars there
- **API docs:** @nestjs/swagger — Swagger UI at `/api` (non-production only)

## Commands

```bash
pnpm run start:dev     # Development with watch mode
pnpm run build         # Compile to dist/
pnpm run start:prod    # Run compiled output

pnpm run test          # Unit tests (Jest, pattern: src/**/*.spec.ts)
pnpm run test:e2e      # E2E tests (config: test/jest-e2e.json)
pnpm run test:cov      # Coverage report

pnpm run lint          # ESLint with auto-fix (src/, test/)
pnpm run format        # Prettier format (src/**/*.ts, test/**/*.ts)
```

## Code Style

Prettier config (`.prettierrc`):

- Single quotes
- Trailing commas: `"all"`

ESLint uses flat config (`eslint.config.mjs`) with TypeScript Project Service. Notable rule overrides:

- `@typescript-eslint/no-explicit-any`: off
- `@typescript-eslint/no-floating-promises`: warn
- `@typescript-eslint/no-unsafe-argument`: warn

## TypeScript

- `experimentalDecorators` and `emitDecoratorMetadata` are **required** — NestJS DI depends on them; do not disable.
- `reflect-metadata` must be imported at the top of `main.ts`.
- Build excludes spec files via `tsconfig.build.json`.

## Testing

- Unit tests live alongside source files in `src/` (`*.spec.ts`).
- E2E tests live in `test/` and use a separate Jest config (`test/jest-e2e.json`).
- Unit Jest config lives in `jest.config.ts` (root); E2E config in `test/jest-e2e.json`. Both transform `.ts` with `ts-jest` and `.js` with `@swc/jest`, and whitelist cockatiel in `transformIgnorePatterns` (cockatiel ships pure ESM, so it must be transformed for Jest's CommonJS runtime).

## Git Conventions

Use **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `ci:`.

## Key Gotchas

- Only `@nestjs/platform-express` is installed. Adding Fastify requires explicit installation and bootstrap changes.
- `@swc/core` is present in devDependencies but the NestJS build pipeline uses `ts-jest` by default — SWC is not wired into the build (only into the Jest test transform via `@swc/jest`) without additional config.
- Server port defaults to `3000`; override with the `PORT` environment variable.
- `.env` and `.env.*.local` files are gitignored — no `.env.example` exists yet.
- **nestjs-zod v5** has no `patchNestJsSwagger` — Swagger integration is automatic; `cleanupOpenApiDoc` in `main.swagger.ts` is the only required hook.
- **Swagger examples:** use `.meta({ example: value })` (singular) on Zod fields. `examples` (plural array) is JSON Schema and is ignored by Swagger UI's "Example Value" display.
