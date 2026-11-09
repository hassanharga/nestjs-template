# NestJS backend template

A NestJS 11 HTTP starter with configuration validation, structured logging, Zod
DTOs, response envelopes, health endpoints, and rate limiting. Monitoring and
outbound-call resilience are optional. No database is required.

## Setup

Use Node `>=26.13.0 <27` and pnpm **12.16.1** (declared in packageManager, Docker, and
CI). Install dependencies only when authorized in your environment.

If you use nvm, run `nvm use` in this directory before pnpm commands.

In a fresh copy:

```bash
node scripts/init-template.mjs orders-api
cp .env.example .env
pnpm install --frozen-lockfile
pnpm start:dev
```

Initialization changes package.json and .env.example only. It does not initialize
Git or touch existing .env files. Set APP_REPOSITORY_URL separately when known.
The default server listens on http://localhost:3000.

| Endpoint          | Contract                                          |
| ----------------- | ------------------------------------------------- |
| GET /v1           | Example greeting envelope                         |
| POST /v1/items    | Validated example input; item envelope            |
| GET /v1/items/1   | Fixed example item; other IDs return 404          |
| GET /health/live  | Unwrapped process liveness                        |
| GET /health/ready | Unwrapped heap, RSS, disk, and draining readiness |
| GET /api          | Swagger UI outside production                     |
| GET /metrics      | Prometheus text when monitoring is enabled        |

The example echoes submitted items; it does not persist them. Remove
ExampleModule from src/features/api.modules.ts and delete src/features/example
when adding your first feature. Register business modules in API_MODULES so the
application and exported contract stay aligned.

## Commands

| Command                                                                                             | Purpose                                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| pnpm start:dev                                                                                      | Development server                                      |
| pnpm build / pnpm start:prod                                                                        | Compile / run compiled output                           |
| pnpm lint:check / pnpm lint                                                                         | Check lint / apply lint fixes                           |
| pnpm format:check / pnpm format                                                                     | Check / write formatting                                |
| pnpm typecheck                                                                                      | Check application and test types without emitting files |
| pnpm test --runTestsByPath src/features/example/app.controller.spec.ts --runInBand --watchman=false | Focused example tests                                   |
| pnpm test:e2e --runTestsByPath test/app.e2e-spec.ts --runInBand --watchman=false                    | HTTP contract tests                                     |
| pnpm test:tooling                                                                                   | Dependency-free initializer tests                       |
| pnpm smoke -- http://127.0.0.1:3000                                                                 | Check an already running server                         |
| pnpm docker:up / pnpm docker:down                                                                   | Start / stop the core container                         |
| pnpm docker:monitoring:up / pnpm docker:monitoring:down                                             | Start / stop optional local monitoring                  |

Pre-commit performs non-mutating lint, type, and formatting checks. CI also tests,
builds, and exercises core and optional-capability containers sequentially.
Agent execution of a full suite still requires explicit authorization.

## Configuration

.env.example lists settings; src/common/config/config.schema.ts defines defaults
and validation. Add variables to both. THROTTLE_TTL is seconds; shutdown/retry/
timeout values are milliseconds; memory limits are MiB.

Credentialed CORS requires explicit origins. For multiple instances behind a
proxy, choose a trusted-proxy policy and shared rate-limit storage in the
consuming project. This starter uses process-local limits.

Read [logging](docs/logging.md), [API contracts](docs/api-contract.md), [capabilities](docs/capabilities.md),
and [release checks](docs/releasing.md) before extending the core.

## License

UNLICENSED. Choose the intended license when creating a project.

## Generated API contract

Run `pnpm api:generate` to build and export `openapi/openapi.json` without a
listening server. `pnpm api:check` fails on contract drift without rewriting the
file. See [API generation](docs/api-generation.md) for registration, frontend
sync, and independent CI checks.

## What template:init does

After copying this starter into a new project, run `pnpm template:init your-project-name`
from its root (or `node scripts/init-template.mjs your-project-name` before installing
dependencies). Use lowercase letters/numbers with hyphens, starting with a letter.
The maximum length is 100 characters.

It changes package.json name and the application identity in .env.example. It
does not rename the directory, install packages, initialize Git, change remotes,
or modify existing .env/.env.local files. Run it before creating your local env
file. If that file already exists, update its application name manually.

Optional server tracing and linked log export: see [observability](docs/observability.md).
