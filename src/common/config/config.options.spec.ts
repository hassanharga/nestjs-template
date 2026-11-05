import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configurationOptions } from './config.options';

it('loads local, environment, base files in order with process values taking priority', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'template-config-'));
  const original = { ...process.env };
  let module: TestingModule | undefined;
  try {
    delete process.env.APP_NAME;
    delete process.env.APP_DESCRIPTION;
    delete process.env.PORT;
    process.env.APP_VERSION = '9.9.9';
    writeFileSync(
      join(dir, '.env'),
      'APP_NAME=base\nAPP_DESCRIPTION=base\nPORT=3010\nAPP_VERSION=1.0.0\n',
    );
    writeFileSync(
      join(dir, '.env.test'),
      'APP_NAME=environment\nAPP_DESCRIPTION=environment\n',
    );
    writeFileSync(join(dir, '.env.local'), 'APP_NAME=local\n');
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(configurationOptions(dir, 'test'))],
    }).compile();
    const config = module.get(ConfigService);
    expect(config.get('APP_NAME')).toBe('local');
    expect(config.get('APP_DESCRIPTION')).toBe('environment');
    expect(config.get('PORT')).toBe(3010);
    expect(config.get('APP_VERSION')).toBe('9.9.9');
  } finally {
    await module?.close();
    for (const key of Object.keys(process.env))
      if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
    rmSync(dir, { recursive: true });
  }
});
