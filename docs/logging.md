# Backend logging

nestjs-pino is installed as the Nest application logger by the shared HTTP setup.
Buffered bootstrap logs flow through the configured logger. Development uses
pino-pretty; test, staging, and production emit JSON to the normal process output.
LOG_LEVEL accepts trace/debug/info/warn/error/fatal/silent and defaults to info.
No remote log collector is required by the HTTP core.

HTTP completion logs use final status: successful requests info, 4xx warn, and
5xx error. Fixed event messages avoid copying user input. Request IDs accept
1-128 letters, digits, dots, underscores, colons, or hyphens; invalid input is
replaced with a generated UUID. The response x-request-id and error-envelope
requestId match the request log correlation ID.

Default HTTP serializers omit raw URLs, queries, headers, bodies, and response
payloads. They retain method, bounded route metadata, ID, status, and duration.
Header/secret-key redaction provides an additional safeguard for explicitly
structured application records. Pass curated metadata; redaction cannot classify
arbitrary personal information or secrets hidden in plain strings.

Use injected PinoLogger for contextual application events:

```typescript
import { PinoLogger } from 'nestjs-pino';

constructor(private readonly logger: PinoLogger) {
  this.logger.setContext('OrdersService');
}

// In an operation:
this.logger.info({ event: 'orders.created', itemCount: 3 });
```

Nest Logger calls are also routed to Pino. Keep events structured and do not
interpolate credentials, DTOs, full URLs, or upstream bodies into messages.
@Log() emits method.called, method.completed, and method.failed with separate
method and durationMs fields (completion/failure duration uses a monotonic clock); explicit payload
logging is sanitized and bounded but still requires reviewed safe input.

Exception diagnostics use error type and bounded source locations without raw
exception messages or nested causes. 4xx filter events are warnings; 5xx are
errors. The public production response remains generic for unexpected failures.
Startup failures before dependency injection use a structured stderr fallback.
Shutdown emits start/completion/failure/timeout events with a shutdownId.

Each enabled MonitoringModule owns its own Prometheus registry and collectors.
Closing an application clears its registry. Injected-registry resilience policies log independently; when
monitoring is enabled, its metrics are registered in that application's registry.
The four monitoring/resilience combinations are covered by module integration
tests, including multiple application instances in the same process.

## Structured helper events

Policies created through the injected ResilienceRegistry emit structured events with a separate policy field:
resilience.retry (debug), resilience.timeout, resilience.bulkhead.rejected, and
resilience.circuit.open (warn), plus resilience.circuit.half_open and
resilience.circuit.closed (info). Policy names should be static configuration
identifiers; never derive them from credentials, user input, or full URLs.
Metric labels and behavior are unchanged.

Method events omit arguments, results, and raw exception messages by default.
Opted-in arguments/results remain sanitized, serialized, and bounded in their
own fields. Both synchronous throws and asynchronous rejections preserve the
original failure. Request-scoped Pino context supplies HTTP correlation for Nest
application logs. Frontend and backend request IDs share the same character and
length policy, including dots and colons.

The standalone @Resilience decorator uses fallback defaults without a DI observer;
it does not emit these events or metrics. Use the injected registry when configured
defaults and observability are required. Timeout records include kind=attempt or
kind=total; caller cancellation is excluded. Bootstrap fallback records include
safe error type/source frames without environment values or raw messages.
