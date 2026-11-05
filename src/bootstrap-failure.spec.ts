import { bootstrapFailureRecord } from './bootstrap-failure';
it('keeps safe startup diagnostic locations without error messages or environment values', () => {
  const error = new Error('TOKEN=private-value');
  const record = bootstrapFailureRecord(error);
  expect(record).toMatchObject({
    event: 'app.bootstrap.failed',
    error: { type: 'Error', frames: expect.any(Array) as unknown[] },
  });
  expect(JSON.stringify(record)).not.toContain('private-value');
  expect(record.error.frames).not.toEqual([]);
});
