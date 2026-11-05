# Releasing a template

Align package.json version and .env.example APP_VERSION. Record changes in
CHANGELOG.md. Consuming projects own their releases and adopt updates explicitly.

Before tagging:

1. Use declared Node/pnpm and a fresh copy without local env/build artifacts.
   Confirm frozen-lockfile installation.
2. Initialize a project name, then run lint, formatting, typecheck, build, and
   focused regressions. Run the full suite only when authorized; repository CI
   is configured for it.
3. Exercise production startup, validation, envelopes, probes, and an active
   request during shutdown.
4. Check monitoring/resilience independently, together, and disabled. Confirm
   cancellation reaches I/O and retries fit the total deadline.
5. Run `pnpm api:check`, compare OpenAPI to HTTP behavior, and check
   example-removal instructions. Sync consuming clients explicitly after changes.

Node 26.13.0 Alpine is pinned to an exact Node release. Record tested image digests in consuming
project releases when exact image reproduction is required. No deployment
integration or automated dependency updater is imposed.
