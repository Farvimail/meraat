import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  closingSpanMinutes,
  deriveToday,
  normalizeRows,
  workedMinutes,
  workedSeconds,
} from '../punch.ts';
import type { PunchRow } from '../types.ts';

const start = (time: string): PunchRow => ({ time, start: 1, pause: 0 });
const pause = (time: string): PunchRow => ({ time, start: 0, pause: 1 });

test('روز خالی: نوبت ورود است', () => {
  const today = deriveToday([]);

  assert.equal(today.entry, null);
  assert.equal(today.exit, null);
  assert.equal(today.present, false);
  assert.equal(today.nextIntent, 'start');
  assert.equal(today.minutes, null);
  assert.deepEqual(today.punches, []);
});

test('بعد از ورود، نوبت خروج است و شیفت باز است', () => {
  const today = deriveToday([start('08:15:00')], { dmy: 13102026 });

  assert.equal(today.entry, '08:15:00');
  assert.equal(today.exit, null);
  assert.equal(today.openSince, '08:15:00');
  assert.equal(today.present, true);
  assert.equal(today.nextIntent, 'pause');
  assert.equal(today.dmy, 13102026);
});

test('ورود و خروج بسته: نوبت ورود بعدی است', () => {
  const today = deriveToday([start('08:15:00'), pause('12:00:00')]);

  assert.equal(today.entry, '08:15:00');
  assert.equal(today.exit, '12:00:00');
  assert.equal(today.present, false);
  assert.equal(today.nextIntent, 'start');
  assert.equal(today.minutes, 225);
});

test('ورود/خروج/ورود: حاضر است، آخرین خروج همان نوبت قبل است', () => {
  const rows = [start('08:15:00'), pause('12:00:00'), start('12:30:00')];
  const today = deriveToday(rows, { now: '13:00:00' });

  assert.equal(today.entry, '08:15:00');
  assert.equal(today.exit, '12:00:00');
  assert.equal(today.openSince, '12:30:00');
  assert.equal(today.present, true);
  assert.equal(today.nextIntent, 'pause');
  // ۲۲۵ دقیقه شیفت اول + ۳۰ دقیقه شیفت باز تا الان
  assert.equal(today.minutes, 255);
});

test('بدون now، شیفت باز در جمع کارکرد نمی‌آید', () => {
  assert.equal(workedMinutes([start('08:15:00'), pause('12:00:00'), start('12:30:00')]), 225);
});

test('ترتیب ورودی مهم نیست', () => {
  const rows = [pause('12:00:00'), start('08:15:00')];
  const today = deriveToday(rows);

  assert.equal(today.entry, '08:15:00');
  assert.equal(today.exit, '12:00:00');
  assert.equal(today.minutes, 225);
});

test('رشته‌های ۰/۱ سرور را مثل عدد می‌خواند', () => {
  const rows = [
    { time: '08:15:00', start: '1', pause: '0' },
    { time: '17:20:00', start: '0', pause: '1' },
  ] as unknown as PunchRow[];

  const today = deriveToday(rows);

  assert.equal(today.entry, '08:15:00');
  assert.equal(today.exit, '17:20:00');
  assert.equal(today.nextIntent, 'start');
  assert.equal(today.minutes, 545);
});

test('ردیف‌های خراب دور ریخته می‌شوند', () => {
  const rows = [
    null,
    { time: '', start: 1, pause: 0 },
    { time: '08:15:00', start: 1, pause: 0 },
    { time: '09:00:00', start: 0, pause: 0 },
  ] as unknown as PunchRow[];

  assert.deepEqual(normalizeRows(rows), [{ time: '08:15:00', start: 1, pause: 0 }]);
});

test('ورودی غیرآرایه باعث خطا نمی‌شود', () => {
  assert.deepEqual(normalizeRows(null), []);
  assert.deepEqual(normalizeRows(undefined), []);
  assert.equal(deriveToday(null).nextIntent, 'start');
});

test('کارکرد با دقت ثانیه حساب می‌شود', () => {
  // ۳۰ ثانیهٔ کامل: اگر مبنا دقیقه بود، این صفر می‌شد.
  assert.equal(workedSeconds([start('08:15:30'), pause('08:16:00')]), 30);
  assert.equal(workedSeconds([]), null);

  const open = [start('08:15:00'), pause('12:00:00'), start('12:30:00')];
  // ۱۳۵۰۰ ثانیه شیفت اول + ۴۵ ثانیه شیفت باز = ۱۳۵۴۵
  assert.equal(workedSeconds(open, { now: '12:30:45' }), 13545);
  // بدون now، شیفت باز شمرده نمی‌شود.
  assert.equal(workedSeconds(open), 13500);
});

test('دقیقه‌ها همان ثانیه‌ها هستند، گرد‌شده به پایین', () => {
  const rows = [start('08:15:00'), pause('08:16:59')];

  assert.equal(workedSeconds(rows), 119);
  assert.equal(workedMinutes(rows), 1);
});

test('طول شیفتی که هر خروج می‌بندد', () => {
  const rows = [start('08:00:00'), pause('12:00:00'), start('12:30:00'), pause('17:00:00')];

  assert.equal(closingSpanMinutes(rows, 1), 240);
  assert.equal(closingSpanMinutes(rows, 3), 270);
});

test('ورود طول شیفت ندارد و خروجِ بی‌ورود هم بی‌طول می‌ماند', () => {
  const rows = [start('08:00:00'), pause('12:00:00')];

  assert.equal(closingSpanMinutes(rows, 0), null);
  assert.equal(closingSpanMinutes([pause('12:00:00')], 0), null);
  assert.equal(closingSpanMinutes(rows, 9), null);
});

test('ساعتِ زندهٔ سرصفحه در ماشین حالت هم می‌آید', () => {
  const today = deriveToday([start('08:15:10'), pause('08:17:40')], { now: '08:17:40' });

  assert.equal(today.seconds, 150);
  assert.equal(today.minutes, 2);
});
