import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const target = process.argv[2] === '--' ? process.argv[3] : process.argv[2];
const base = new URL(target ?? 'http://127.0.0.1:3000');
if (!['http:', 'https:'].includes(base.protocol))
  throw new Error('Expected an HTTP(S) URL');

async function request(path, options = {}) {
  return fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(2000),
  });
}

let live = false;
for (let attempt = 0; attempt < 20; attempt += 1) {
  try {
    const response = await request('/health/live');
    live = response.ok && (await response.json()).status === 'ok';
    if (live) break;
  } catch {
    // Connection failures are expected while a newly started container boots.
  }
  await setTimeout(1000);
}
assert.ok(live, 'Application did not become live');
const ready = await request('/health/ready');
assert.equal(ready.status, 200, 'Readiness check failed');
const item = await request('/v1/items/1');
assert.equal(item.status, 200);
assert.equal((await item.json()).data.id, 1);
const invalid = await request('/v1/items', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: -1, name: '' }),
});
assert.equal(invalid.status, 400, 'Invalid input was accepted');
const missing = await request('/v1/items/999');
assert.equal(missing.status, 404);
assert.equal((await missing.json()).success, false);
if (process.env.SMOKE_MONITORING === 'true') {
  const metrics = await request('/metrics');
  assert.equal(metrics.status, 200);
  assert.match(await metrics.text(), /http_requests_total/);
}
process.stdout.write(
  'PASS: liveness, readiness, item contract, validation, missing item, optional metrics\n',
);
