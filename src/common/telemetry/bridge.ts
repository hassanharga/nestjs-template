export type TraceFields = {
  trace_id?: string;
  span_id?: string;
  trace_flags?: number;
};
export interface ServerSpan {
  run<T>(operation: () => T): T;
  end(status: number): void;
}
export interface TelemetryRuntime {
  fields(): TraceFields;
  server(traceparent: string | undefined): ServerSpan;
  operation<T>(
    name: string,
    traceparent: string | undefined,
    operation: () => Promise<T>,
  ): Promise<T>;
  client<T>(method: string, operation: () => Promise<T>): Promise<T>;
  inject(headers: Headers): void;
  log(record: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
const runtimeKey = Symbol.for('template.telemetry.runtime');
const state = globalThis as typeof globalThis & {
  [runtimeKey]?: TelemetryRuntime;
};
export function telemetryRuntime() {
  return state[runtimeKey];
}
export function installTelemetryRuntime(runtime: TelemetryRuntime | undefined) {
  state[runtimeKey] = runtime;
}
export function traceFields(): TraceFields {
  return telemetryRuntime()?.fields() ?? {};
}
export function emitTelemetryLog(record: Record<string, unknown>): void {
  try {
    telemetryRuntime()?.log(record);
  } catch {
    /* Remote logging never breaks application work. */
  }
}
export async function flushTelemetry(): Promise<void> {
  await telemetryRuntime()?.flush();
}
export async function stopTelemetry(): Promise<void> {
  await telemetryRuntime()?.shutdown();
}
export async function withTelemetryOperation<T>(
  name: string,
  traceparent: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const runtime = telemetryRuntime();
  return runtime
    ? runtime.operation(name, traceparent, operation)
    : operation();
}
export const requestTelemetry = {
  async run<T>(method: string, operation: () => Promise<T>): Promise<T> {
    const runtime = telemetryRuntime();
    return runtime ? runtime.client(method, operation) : operation();
  },
  inject(headers: Headers) {
    telemetryRuntime()?.inject(headers);
  },
};
