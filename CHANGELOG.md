# Changelog

## Unreleased

- Make monitoring and resilience independently optional.
- Correct health checks, metrics, logging defaults, and production errors.
- Share HTTP setup with tests and document versioned response envelopes.
- Add initialization, read-only checks, CI, and container smoke verification.
- Pin pnpm, declare Node requirements, and align licensing metadata.
- Audit Pino correlation, severity, privacy, bootstrap and shutdown logging across modules.
- Isolate metrics per application and test all optional-module combinations.
- Update runtime baseline to Node 26.13.0 LTS and pnpm 12.16.1.
- Export deterministic business OpenAPI contracts without listening; check drift in CI.
- Share business-module registration and retain complete output on repeated clean builds.
- Emit structured method/resilience events with separate timing and policy fields.
- Handle wrapped fetch failures, isolate timeout observation, and distinguish attempt/total budgets.
- Add configurable readiness dwell, safe bootstrap diagnostics, and missing boundary regression cases.
- Verify initialization against shipped settings and avoid duplicate PR workflows.

## Optional observability

- Add opt-in server traces, safe linked OTLP logs and request propagation.
- Simplify local monitoring to a pinned Grafana LGTM development container.
- Preserve default terminal logging and collector-free startup.
