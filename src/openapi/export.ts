import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { configureApplication } from '../main.config';
import { createApiDocument } from '../main.swagger';
import { OpenApiExportModule } from './export.module';

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sorted(entry)]),
    );
  }
  return value;
}

/** Create the HTTP adapter for route metadata, without opening a TCP listener. */
export async function exportApiDocument(): Promise<string> {
  const app = await NestFactory.create(OpenApiExportModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const config = app.get(ConfigService);
    configureApplication(app, config);
    return `${JSON.stringify(sorted(createApiDocument(app, config)), null, 2)}\n`;
  } finally {
    await app.close();
  }
}

export async function writeApiContract(
  path: string,
  check = false,
): Promise<void> {
  const content = await exportApiDocument();
  if (check) {
    let existing: string;
    try {
      existing = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      throw new Error(
        `OpenAPI contract missing: ${path}. Run pnpm api:generate.`,
      );
    }
    if (existing !== content) {
      throw new Error(
        `OpenAPI contract out of date: ${path}. Run pnpm api:generate.`,
      );
    }
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check') || args.length > 1) {
    throw new Error('Usage: node dist/openapi/export.js [--check]');
  }
  await writeApiContract(
    resolve('openapi/openapi.json'),
    args.includes('--check'),
  );
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
