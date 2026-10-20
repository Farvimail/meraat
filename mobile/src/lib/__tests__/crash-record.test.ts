import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toCrashRecord } from '../crash-record.ts';

/**
 * گزارشِ خطا خودش نباید خطا بدهد.
 *
 * این تست‌ها همان چیزهایی را می‌سنجند که در گزارشِ واقعی مهم‌اند: پیامِ خوانا،
 * سقفِ طول (چون `SecureStore` اندازهٔ محدود دارد) و رفتارِ درست با چیزهایی که
 * `Error` نیستند — هندلرِ سراسری هر مقداری را ممکن است ببیند.
 */

test('خطای معمولی: پیام و مسیرِ خطا هر دو می‌آیند', () => {
  const error = new Error('Cannot read property');
  const record = toCrashRecord('render', error, new Date('2026-10-20T12:00:00.000Z'));

  assert.equal(record.where, 'render');
  assert.equal(record.message, 'Cannot read property');
  assert.ok(record.stack && record.stack.includes('Cannot read property'));
  assert.equal(record.at, '2026-10-20T12:00:00.000Z');
});

test('مقدارِ غیرِ Error به پیامِ خوانا تبدیل می‌شود', () => {
  assert.equal(toCrashRecord('global', 'سقوط در promise').message, 'سقوط در promise');
  // شیئِ بی‌پیام به «[object Object]» تبدیل نمی‌شود؛ همان جملهٔ فارسی می‌نشیند.
  assert.equal(toCrashRecord('global', { code: 7 }).message, 'خطای نامشخص');
});

test('خطای تهی، پیامِ «نامشخص» می‌گیرد نه رشتهٔ خالی', () => {
  assert.equal(toCrashRecord('global', undefined).message, 'خطای نامشخص');
  assert.equal(toCrashRecord('global', new Error('   ')).message, 'خطای نامشخص');
});

test('پیام و مسیرِ خطا کوتاه می‌شوند تا در حافظهٔ امن جا بشوند', () => {
  const huge = new Error('x'.repeat(2000));
  const record = toCrashRecord('render', huge);

  assert.ok(record.message.length <= 301, `پیام ${record.message.length} کاراکتر شد`);
  assert.ok(record.stack !== null && record.stack.length <= 601);
  assert.ok(record.message.endsWith('…'));
});

test('بدونِ stack، مقدار null می‌ماند', () => {
  const error = new Error('بی‌مسیر');
  error.stack = undefined;

  assert.equal(toCrashRecord('render', error).stack, null);
});
