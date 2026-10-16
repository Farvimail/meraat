import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { workedSeconds } from '../punch.ts';
import type { PunchRow } from '../types.ts';

/**
 * تایمرِ پنلِ وب و تایمرِ اپ باید همیشه **یک عدد** بدهند.
 *
 * این تست همان فایلِ مرورگر (`public/js/timer.js`) را در یک محیطِ ساختگی اجرا
 * می‌کند و نتیجه‌اش را با `workedSeconds` می‌سنجد. جای این تست عمداً پکیجِ
 * موبایل است، چون تنها اجراکنندهٔ تستِ مخزن همین‌جاست و خطرِ اصلی هم دقیقاً
 * همین است: دو پیاده‌سازیِ موازی که از هم جدا می‌افتند.
 */

const panelPath = fileURLToPath(new URL('../../../../public/js/timer.js', import.meta.url));

/** همان ثانیهٔ روزِ سرور که تابعِ `timerSecondsOfDay` پنل می‌خواند. */
function secondsOfDay(time: string): number {
  const [h, m, s] = time.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

/** ردیفِ اپ (`time`) → ردیفِ پنل (`date`)، با همان پرچم‌هایی که سرور می‌فرستد. */
function panelRow(row: PunchRow, kind: 'number' | 'string') {
  return {
    date: `10/15/2026, ${row.time}`,
    start: kind === 'number' ? row.start : String(row.start),
    pause: kind === 'number' ? row.pause : String(row.pause),
  };
}

interface Panel {
  timerWorked: (data: string) => { closed: number; openSince: number | null; present: boolean };
  timerElapsedSeconds: (worked: unknown, nowSeconds: number) => number;
  timerFormat: (seconds: number) => string;
  timerSecondsOfDay: (entry: unknown) => number | null;
}

let cached: Panel | null = null;

/** `timer.js` را مثل مرورگر اجرا می‌کند و حساب‌های تایمر را برمی‌گرداند. */
function panel(): Panel {
  if (cached) return cached;

  const noop = () => undefined;
  const chain = (): Record<string, unknown> => ({
    click: noop,
    on: noop,
    ready: noop,
    attr: () => '',
    parent: chain,
  });
  // همان چیزی که timer.js از jQuery می‌خواهد: یک تابعِ زنجیره‌ای + ajaxSetup.
  const jquery = Object.assign((): Record<string, unknown> => chain(), { ajaxSetup: noop });

  const sandbox: Record<string, unknown> = {
    $: jquery,
    document: { querySelectorAll: () => [], querySelector: () => null },
    console: { log: noop, error: noop, warn: noop },
    JSON,
    Math,
    Date,
    setTimeout: noop,
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
  };
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(readFileSync(panelPath, 'utf8'), sandbox, { filename: panelPath });

  cached = sandbox as unknown as Panel;
  return cached;
}

const start = (time: string): PunchRow => ({ time, start: 1, pause: 0 });
const pause = (time: string): PunchRow => ({ time, start: 0, pause: 1 });

/** عددِ پنل در لحظهٔ `now`، درست مثل `Interval`. */
function panelSeconds(rows: PunchRow[], now: string, kind: 'number' | 'string' = 'number'): number {
  const worked = panel().timerWorked(JSON.stringify(rows.map((row) => panelRow(row, kind))));

  return panel().timerElapsedSeconds(worked, secondsOfDay(now));
}

const CASES: Array<{ name: string; rows: PunchRow[]; now: string }> = [
  {
    name: 'شیفتِ باز (حالتِ گزارش‌شده: ورود ۰۱:۰۱، ناهار ۱۱:۰۵ تا ۱۱:۵۳)',
    rows: [start('01:01:00'), pause('11:05:32'), start('11:53:27')],
    now: '15:13:19',
  },
  {
    name: 'شیفتِ بسته',
    rows: [start('01:01:00'), pause('11:05:32'), start('11:53:27'), pause('15:02:00')],
    now: '15:13:19',
  },
  {
    name: 'ورود بدون خروج',
    rows: [start('08:15:00')],
    now: '12:30:45',
  },
  {
    name: 'دو ورودِ پشت‌سرهم (ثبتِ تکراری از پنل)',
    rows: [start('08:00:00'), start('09:00:00'), pause('12:00:00')],
    now: '13:00:00',
  },
  {
    name: 'دو خروجِ پشت‌سرهم',
    rows: [start('08:00:00'), pause('12:00:00'), pause('12:30:00')],
    now: '13:00:00',
  },
  {
    name: 'خروجِ بی‌ورود',
    rows: [pause('08:00:00'), start('22:00:00')],
    now: '23:30:00',
  },
];

test('تایمرِ پنل و تایمرِ اپ روی هر روزِ کاری یک عدد می‌دهند', () => {
  for (const item of CASES) {
    const app = workedSeconds(item.rows, { now: item.now });

    assert.equal(panelSeconds(item.rows, item.now), app, item.name);
  }
});

test('روزِ خالی: اپ «عددی ندارد» و پنل صفرِ قالب‌بندی‌شده نشان می‌دهد', () => {
  // تنها جایی که دو طرف عمداً یکی نیستند: اپ جای عدد، متنِ راهنما می‌گذارد و
  // پنل کارتِ همیشه‌موجود را ۰۰:۰۰:۰۰ نگه می‌دارد.
  assert.equal(workedSeconds([]), null);
  assert.equal(panelSeconds([], '09:00:00'), 0);
  assert.equal(panel().timerFormat(panelSeconds([], '09:00:00')), `00 : 00' : 00"`);
});

test('پرچم‌های ۰/۱ چه عدد باشند چه رشته، یک نتیجه می‌دهند', () => {
  for (const item of CASES) {
    assert.equal(panelSeconds(item.rows, item.now, 'string'), panelSeconds(item.rows, item.now), item.name);
  }
});

test('در حالِ حضور، عددِ پنل کارکرد است نه ساعتِ مرورگر', () => {
  // در روزِ گزارش‌شده پنل عددی مثل ساعتِ UTC (۱۱:۴۳) نشان می‌داد؛ کارکرد واقعی
  // ۱۳:۲۴:۲۴ است و تایمر باید همان را بگوید.
  const rows = [start('01:01:00'), pause('11:05:32'), start('11:53:27')];

  assert.equal(panelSeconds(rows, '15:13:19'), 13 * 3600 + 24 * 60 + 24);
  assert.notEqual(panelSeconds(rows, '15:13:19'), secondsOfDay('11:43:19'));
});

test('عددِ پنل بدون شیفتِ باز ثابت است و با شیفتِ باز جلو می‌رود', () => {
  const closed = [start('08:15:00'), pause('12:00:00')];
  const open = [start('08:15:00'), pause('12:00:00'), start('12:30:00')];

  assert.equal(panelSeconds(closed, '12:00:00'), panelSeconds(closed, '18:00:00'));
  assert.equal(panelSeconds(open, '13:00:00'), 255 * 60);
  assert.equal(panelSeconds(open, '13:00:30'), 255 * 60 + 30);
});

test('قالبِ نمایش همان «HH : MM\' : SS"» است', () => {
  const format = panel().timerFormat;

  assert.equal(format(13 * 3600 + 13 * 60 + 5), `13 : 13' : 05"`);
  assert.equal(format(0), `00 : 00' : 00"`);
});
