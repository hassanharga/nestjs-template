import { Writable } from 'node:stream';
import { emitTelemetryLog } from './bridge';

/** Dedicated Pino destination: preserve stdout and forward only redacted JSON records. */
export function telemetryLogStream(): Writable {
  let pending = '';
  return new Writable({
    write(chunk: Buffer, _encoding, callback) {
      process.stdout.write(chunk);
      pending += chunk.toString();
      if (pending.length > 65536) {
        pending = '';
        callback();
        return;
      }
      let end: number;
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        try {
          emitTelemetryLog(JSON.parse(line) as Record<string, unknown>);
        } catch {
          /* Non-JSON never enters remote telemetry. */
        }
      }
      callback();
    },
  });
}
