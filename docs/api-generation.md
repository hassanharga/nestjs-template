# Generated API contract

The backend owns `openapi/openapi.json`. Commit the contract together with changes
that affect public controllers, DTOs, or response schemas. The sibling Next.js
template uses this file to generate its API types and typed client.

```bash
pnpm api:generate
pnpm api:check
```

Both commands build the backend first. Generation writes the contract; checking
fails if the file is missing or its bytes differ, without changing it. To invoke
the compiled exporter directly after a build:

```bash
node dist/openapi/export.js
node dist/openapi/export.js --check
```

Run these commands from the backend root. Success leaves stdout empty; failures
report a message to stderr and exit nonzero. No API server or database is needed.
The exporter creates a Nest HTTP application for route metadata, never calls
`listen`, and closes the application even if document generation fails.

## Contract scope

Register business modules once in `src/features/api.modules.ts`. Both `AppModule`
and the export module use that list. Swagger UI and the exporter call the same
`createApiDocument` helper with that business module list, so health probes and
optional monitoring routes are excluded from the public API contract.

The exporter also uses the shared `configureApplication` helper. This preserves
URI versioning (`/v1`) and application HTTP configuration. DTO validation metadata
and success/error envelopes come from the same decorators used by the live API.
When changing a prefix or version, update that shared configuration and regenerate.

Export configuration ignores process environment variables and all `.env` files.
It uses schema defaults plus test mode and silent logging. Local names, repository
URLs, optional capabilities, and runtime timestamps cannot enter the checked-in
contract. JSON object keys are sorted; arrays retain their declared order.

To change the portable API title, description, or version, change the config schema
defaults and regenerate. Adding a business module requires adding it to
`API_MODULES`. Infrastructure modules stay outside that list.

## Frontend generation

From `FE/nextjs`, explicitly import the updated contract:

```bash
pnpm api:sync ../../BE/nestjs/openapi/openapi.json
pnpm api:check
```

Use the actual exported-file path when the projects live elsewhere. The frontend
`api:generate` command only regenerates types from its own snapshot; it does not
copy a backend contract. Commit both frontend artifacts. CI checks backend contract drift
and frontend type drift separately. See the frontend API documentation for the
client's transport and error behavior.
