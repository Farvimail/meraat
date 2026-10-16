import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatClock,
  formatClockWithSeconds,
  formatDmyFull,
  formatDmyLong,
  formatDuration,
  formatStopwatch,
  gregorianToJalali,
  minutesBetween,
  parseClock,
  parseDmy,
  toPersianDigits,
} from '../jalali.ts';

test('نوروزهای شناخته‌شده را درست تبدیل می‌کند', () => {
  assert.deepEqual(gregorianToJalali(2024, 3, 20), { jy: 1403, jm: 1, jd: 1 });
  assert.deepEqual(gregorianToJalali(2025, 3, 21), { jy: 1404, jm: 1, jd: 1 });
  assert.deepEqual(gregorianToJalali(2026, 3, 21), { jy: 1405, jm: 1, jd: 1 });
});

test('آخرین روز سال و روزهای میانی را درست می‌برد', () => {
  assert.deepEqual(gregorianToJalali(2026, 3, 20), { jy: 1404, jm: 12, jd: 29 });
  assert.deepEqual(gregorianToJalali(2021, 1, 1), { jy: 1399, jm: 10, jd: 12 });
  assert.deepEqual(gregorianToJalali(1979, 2, 11), { jy: 1357, jm: 11, jd: 22 });
});

test('dmy سامانه را می‌خواند و به تاریخ شمسی می‌برد', () => {
  const date = parseDmy(13102026);

  assert.ok(date, '۱۳۱۰۲۰۲۶ باید خوانده شود');
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 9); // اکتبر
  assert.equal(date.getDate(), 13);
  assert.equal(formatDmyLong(13102026), '۲۱ مهر ۱۴۰۵');

  // عدد باید دقیقاً ۸ رقم باشد؛ وگرنه صفرهای ابتدایی گم می‌شوند.
  assert.equal(parseDmy(3102026), null);
  assert.equal(parseDmy(32132026), null);
  assert.equal(formatDmyLong(3102026), '—');
});

test('ارقام لاتین را فارسی می‌کند', () => {
  assert.equal(toPersianDigits('08:15'), '۰۸:۱۵');
  assert.equal(toPersianDigits(1405), '۱۴۰۵');
});

test('ساعت را می‌خواند و قالب‌بندی می‌کند', () => {
  assert.deepEqual(parseClock('23:59:59'), { h: 23, m: 59, s: 59 });
  assert.deepEqual(parseClock('8:5'), { h: 8, m: 5, s: 0 });

  assert.equal(parseClock('24:00:00'), null);
  assert.equal(parseClock('12:60:00'), null);
  assert.equal(parseClock('نیمه‌شب'), null);

  assert.equal(formatClock('08:15:00'), '۰۸:۱۵');
  assert.equal(formatClock('8:5'), '۰۸:۰۵');
  assert.equal(formatClock(null), '—');
  assert.equal(formatClock('bogus'), '—');
});

test('دقیقه‌های بین دو ساعت', () => {
  assert.equal(minutesBetween('08:15:00', '17:20:00'), 545);
  assert.equal(minutesBetween('08:15', '08:15'), 0);
  // خروج قبل از ورود معنا ندارد.
  assert.equal(minutesBetween('17:00:00', '08:00:00'), null);
  assert.equal(minutesBetween('bad', '08:00:00'), null);
});

test('کارکرد را به فارسی می‌نویسد', () => {
  assert.equal(formatDuration(545), '۹ ساعت و ۵ دقیقه');
  assert.equal(formatDuration(120), '۲ ساعت');
  assert.equal(formatDuration(45), '۴۵ دقیقه');
  assert.equal(formatDuration(0), '—');
  assert.equal(formatDuration(null), '—');
});

test('تایمر کارکرد را با ثانیه و صفرِ ابتدایی می‌نویسد', () => {
  assert.equal(formatStopwatch(0), '۰۰:۰۰:۰۰');
  assert.equal(formatStopwatch(45), '۰۰:۰۰:۴۵');
  assert.equal(formatStopwatch(7843), '۰۲:۱۰:۴۳');
  assert.equal(formatStopwatch(13545), '۰۳:۴۵:۴۵');
  // شیفت طولانی: ساعت از ۲۴ هم می‌گذرد و سقف نمی‌خوریم.
  assert.equal(formatStopwatch(90000), '۲۵:۰۰:۰۰');
  assert.equal(formatStopwatch(null), '—');
});

test('ساعتِ سرصفحه ثانیه دارد و تاریخ روز هفته را هم می‌آورد', () => {
  assert.equal(formatClockWithSeconds('08:32:05'), '۰۸:۳۲:۰۵');
  assert.equal(formatClockWithSeconds('bogus'), '--:--:--');
  assert.equal(formatClockWithSeconds(null), '--:--:--');

  // ۱۳ اکتبر ۲۰۲۶ سه‌شنبه است.
  assert.equal(formatDmyFull(13102026), 'سه‌شنبه ۲۱ مهر ۱۴۰۵');
  assert.equal(formatDmyFull(3102026), '—');
});
