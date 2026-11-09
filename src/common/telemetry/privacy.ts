const identifier = /^[A-Za-z0-9._:-]{1,128}$/;
export const safeEvent = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,79}$/.test(value)
    ? value
    : undefined;
export const safeMethod = (value: unknown): string =>
  typeof value === 'string' &&
  [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'HEAD',
    'OPTIONS',
    'CONNECT',
    'TRACE',
  ].includes(value.toUpperCase())
    ? value.toUpperCase()
    : 'OTHER';
export function logMetadata(
  record: Record<string, unknown>,
): Record<string, string | number> {
  const context =
    record.context && typeof record.context === 'object'
      ? (record.context as Record<string, unknown>)
      : record;
  const result: Record<string, string | number> = {};
  const requestId = context.requestId ?? record.requestId ?? record.reqId;
  if (typeof requestId === 'string' && identifier.test(requestId))
    result.requestId = requestId;
  for (const key of ['operation', 'policy', 'code']) {
    const value = context[key];
    if (typeof value === 'string' && identifier.test(value))
      result[key] = value;
  }
  for (const key of ['status', 'durationMs']) {
    const value = context[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
      result[key] = value;
  }
  if (context.method) result.method = safeMethod(context.method);
  if (context.kind === 'attempt' || context.kind === 'total')
    result.kind = context.kind;
  return result;
}
export function exporterHeaders(value: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!value) return headers;
  try {
    for (const entry of value.split(',')) {
      const separator = entry.indexOf('=');
      if (separator < 1) throw new Error();
      const name = entry.slice(0, separator).trim();
      const content = decodeURIComponent(entry.slice(separator + 1).trim());
      const check = new Headers({ [name]: content });
      headers[name] = check.get(name)!;
    }
  } catch {
    throw new Error('Invalid OTEL_EXPORTER_OTLP_HEADERS format');
  }
  return headers;
}

/** Preserve Pino trace/fatal and frontend levels in OTLP and Grafana. */
export function logSeverity(level: unknown) {
  const names: Record<number, string> = {
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR',
    60: 'FATAL',
  };
  const values: Record<string, number> = {
    TRACE: 1,
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
    FATAL: 21,
  };
  const name =
    typeof level === 'number'
      ? names[level]
      : typeof level === 'string'
        ? level.toUpperCase()
        : 'INFO';
  return {
    severityNumber: values[name] ?? 9,
    severityText: values[name] ? name : 'INFO',
  };
}
