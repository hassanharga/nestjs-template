import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { initializeTemplate } from './init-template.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'template-init-'));
  await writeFile(
    join(root, 'package.json'),
    '{"name":"starter","version":"0.0.1"}\n',
  );
  await writeFile(
    join(root, '.env.example'),
    await readFile(new URL('../.env.example', import.meta.url), 'utf8'),
  );
  return root;
}

test('initializes package and example environment without touching local secrets', async () => {
  const root = await fixture();
  await writeFile(join(root, '.env'), 'TOKEN=keep-local\n');
  await initializeTemplate(root, 'orders-api');
  assert.equal(
    JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).name,
    'orders-api',
  );
  assert.match(
    await readFile(join(root, '.env.example'), 'utf8'),
    /^APP_NAME=orders-api$/m,
  );
  const original = await readFile(
    new URL('../.env.example', import.meta.url),
    'utf8',
  );
  assert.equal(
    await readFile(join(root, '.env.example'), 'utf8'),
    original
      .replace(/^APP_NAME=.*$/m, 'APP_NAME=orders-api')
      .replace(/^APP_VERSION=.*$/m, 'APP_VERSION=0.0.1'),
  );
  assert.equal(
    await readFile(join(root, '.env'), 'utf8'),
    'TOKEN=keep-local\n',
  );
});

test('rejects invalid names before writing either file', async () => {
  const root = await fixture();
  const before = await readFile(join(root, 'package.json'), 'utf8');
  await assert.rejects(initializeTemplate(root, '../../other'), /lowercase/);
  assert.equal(await readFile(join(root, 'package.json'), 'utf8'), before);
});

test('validates the environment example before mutating the package', async () => {
  const root = await mkdtemp(join(tmpdir(), 'template-init-missing-'));
  await writeFile(join(root, 'package.json'), '{"name":"starter"}\n');
  await assert.rejects(initializeTemplate(root, 'orders-api'), /ENOENT/);
  assert.equal(
    await readFile(join(root, 'package.json'), 'utf8'),
    '{"name":"starter"}\n',
  );
});
