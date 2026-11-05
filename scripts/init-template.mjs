import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Rename a copied template. Existing .env files are deliberately never read. */
export async function initializeTemplate(root, name) {
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name ?? '') ||
    name.length > 100
  ) {
    throw new Error(
      'Use a lowercase name such as orders-api (maximum 100 characters).',
    );
  }
  const packagePath = resolve(root, 'package.json');
  const envPath = resolve(root, '.env.example');
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  const environment = await readFile(envPath, 'utf8');
  const renamedEnvironment = environment
    .replace(/^APP_NAME=.*$/m, `APP_NAME=${name}`)
    .replace(/^APP_VERSION=.*$/m, `APP_VERSION=${manifest.version ?? '0.0.1'}`);
  manifest.name = name;
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(envPath, renamedEnvironment);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await initializeTemplate(process.cwd(), process.argv[2]);
    process.stdout.write(
      'Updated package.json and .env.example. Copy the example to a local env file when ready.\n',
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Template initialization failed'}\n`,
    );
    process.exitCode = 1;
  }
}
