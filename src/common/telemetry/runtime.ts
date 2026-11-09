import { AsyncLocalStorage } from 'node:async_hooks';
import {
  context,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
  isSpanContextValid,
  type Span,
  type SpanContext,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type ReadableSpan,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  installTelemetryRuntime,
  telemetryRuntime,
  type TelemetryRuntime,
} from './bridge';
import { parseTelemetryOptions } from './options';
import {
  exporterHeaders,
  logMetadata,
  logSeverity,
  safeEvent,
  safeMethod,
} from './privacy';

const scopeName = 'template.observability';
function remoteParent(value: string | undefined): SpanContext | undefined {
  const match = value?.match(
    /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/,
  );
  if (!match) return undefined;
  const result = {
    traceId: match[1],
    spanId: match[2],
    traceFlags: parseInt(match[3], 16) & 1,
    isRemote: true,
  };
  return isSpanContextValid(result) ? result : undefined;
}
function safeSpan(span: ReadableSpan): ReadableSpan {
  const attributes: Record<string, string | number> = {};
  for (const key of [
    'http.request.method',
    'http.response.status_code',
    'app.operation',
  ]) {
    const value = span.attributes[key];
    if (typeof value === 'number' && Number.isFinite(value))
      attributes[key] = value;
    if (typeof value === 'string' && safeEvent(value.toLowerCase()))
      attributes[key] = value.slice(0, 80);
  }
  const original = span.spanContext();
  return {
    name: safeEvent(span.name) ?? 'app.operation',
    kind: span.kind,
    spanContext: () => ({
      traceId: original.traceId,
      spanId: original.spanId,
      traceFlags: original.traceFlags,
    }),
    parentSpanContext: span.parentSpanContext
      ? {
          traceId: span.parentSpanContext.traceId,
          spanId: span.parentSpanContext.spanId,
          traceFlags: span.parentSpanContext.traceFlags,
        }
      : undefined,
    startTime: span.startTime,
    endTime: span.endTime,
    duration: span.duration,
    ended: span.ended,
    status: { code: span.status.code },
    attributes,
    events: [],
    links: [],
    resource: span.resource,
    instrumentationScope: { name: scopeName },
    droppedAttributesCount: span.droppedAttributesCount,
    droppedEventsCount: span.droppedEventsCount,
    droppedLinksCount: span.droppedLinksCount,
  };
}

/** Loads only behind FEATURE_TELEMETRY; no auto-instrumentation or resource detection. */
export function startTelemetry(
  source: Record<string, unknown>,
  serviceName: string,
): TelemetryRuntime | undefined {
  const settings = parseTelemetryOptions(source, serviceName);
  if (!settings.FEATURE_TELEMETRY) return undefined;
  const existing = telemetryRuntime();
  if (existing) return existing;
  const endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT!.replace(/\/$/, '');
  const headers = exporterHeaders(settings.OTEL_EXPORTER_OTLP_HEADERS);
  const resource = resourceFromAttributes({
    'service.name': settings.OTEL_SERVICE_NAME,
  });
  const exporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers,
    timeoutMillis: 2000,
  });
  let lastDiagnostic = 0;
  const diagnostic = () => {
    if (Date.now() - lastDiagnostic < 30000) return;
    lastDiagnostic = Date.now();
    process.stderr.write(
      JSON.stringify({ level: 'warn', event: 'telemetry.export_failed' }) +
        '\n',
    );
  };
  const guardedExporter: SpanExporter = {
    export(spans, callback) {
      exporter.export(spans, (result) => {
        if (Number(result.code) !== 0) diagnostic();
        callback({ code: result.code });
      });
    },
    shutdown: () => exporter.shutdown(),
  };
  const batch = new BatchSpanProcessor(guardedExporter, {
    maxQueueSize: 128,
    maxExportBatchSize: 32,
    scheduledDelayMillis: 1000,
    exportTimeoutMillis: 3000,
  });
  const processor: SpanProcessor = {
    onStart() {},
    onEnd(span) {
      if (span.instrumentationScope.name === scopeName)
        batch.onEnd(safeSpan(span));
    },
    forceFlush: () => batch.forceFlush(),
    shutdown: () => batch.shutdown(),
  };
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [processor],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(settings.OTEL_TRACES_SAMPLER_ARG),
    }),
  });
  tracerProvider.register({ propagator: null });
  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers,
    timeoutMillis: 2000,
  });
  const logProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: logExporter,
        maxQueueSize: 128,
        maxExportBatchSize: 32,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 3000,
      }),
    ],
  });
  const logger = logProvider.getLogger(scopeName);
  const tracer = tracerProvider.getTracer(scopeName);
  const active = new AsyncLocalStorage<Span>();
  const parentContext = (parent?: SpanContext) =>
    parent ? trace.setSpanContext(ROOT_CONTEXT, parent) : ROOT_CONTEXT;
  const makeSpan = (name: string, kind: SpanKind, carrier?: string) => {
    const parent = active.getStore()?.spanContext() ?? remoteParent(carrier);
    return tracer.startSpan(
      safeEvent(name) ?? 'app.operation',
      { kind },
      parentContext(parent),
    );
  };
  const run = <T>(span: Span, operation: () => T): T =>
    active.run(span, () =>
      context.with(trace.setSpan(ROOT_CONTEXT, span), operation),
    );
  const perform = async <T>(
    span: Span,
    operation: () => Promise<T>,
  ): Promise<T> =>
    run(span, async () => {
      try {
        return await operation();
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  let stopping: Promise<void> | undefined;
  let flushing: Promise<void> | undefined;
  const runtime: TelemetryRuntime = {
    fields() {
      const value = active.getStore()?.spanContext();
      return value && isSpanContextValid(value)
        ? {
            trace_id: value.traceId,
            span_id: value.spanId,
            trace_flags: value.traceFlags,
          }
        : {};
    },
    server(carrier) {
      const span = makeSpan('http.server', SpanKind.SERVER, carrier);
      let ended = false;
      return {
        run: (operation) => run(span, operation),
        end(status) {
          if (ended) return;
          ended = true;
          span.setAttribute('http.response.status_code', status);
          if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          span.end();
        },
      };
    },
    operation(name, carrier, operation) {
      return perform(makeSpan(name, SpanKind.SERVER, carrier), operation);
    },
    client(method, operation) {
      const span = makeSpan('http.client', SpanKind.CLIENT);
      span.setAttribute('http.request.method', safeMethod(method));
      return perform(span, operation);
    },
    inject(output) {
      output.delete('tracestate');
      output.delete('baggage');
      const fields = runtime.fields();
      if (fields.trace_id && fields.span_id)
        output.set(
          'traceparent',
          `00-${fields.trace_id}-${fields.span_id}-${(fields.trace_flags ?? 0).toString(16).padStart(2, '0')}`,
        );
    },
    log(record) {
      const event = safeEvent(record.event) ?? safeEvent(record.msg);
      if (!event) return;
      const metadata = logMetadata(record);
      const fields = runtime.fields();
      const span = active.getStore();
      logger.emit({
        context: span ? trace.setSpan(ROOT_CONTEXT, span) : ROOT_CONTEXT,
        ...logSeverity(record.level),
        body: JSON.stringify({ event, ...metadata, ...fields }),
        attributes: { event, ...metadata },
      });
    },
    async flush() {
      if (!flushing)
        flushing = Promise.allSettled([
          tracerProvider.forceFlush(),
          logProvider.forceFlush(),
        ])
          .then((results) => {
            if (results.some((result) => result.status === 'rejected'))
              diagnostic();
          })
          .finally(() => {
            flushing = undefined;
          });
      await flushing;
    },
    async shutdown() {
      if (!stopping)
        stopping = (async () => {
          await runtime.flush();
          await Promise.allSettled([
            tracerProvider.shutdown(),
            logProvider.shutdown(),
          ]);
          if (telemetryRuntime() === runtime)
            installTelemetryRuntime(undefined);
          trace.disable();
          context.disable();
        })();
      await stopping;
    },
  };
  installTelemetryRuntime(runtime);
  return runtime;
}
