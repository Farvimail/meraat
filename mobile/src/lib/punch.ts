import type { PunchRow } from './types';

/**
 * منطق «چه کاری الان مجاز است» از روی رکوردهای امروز.
 *
 * این عیناً همان قاعده‌ای است که سرور در `SavedTimeController::noDuplicate()`
 * اجرا می‌کند: اگر آخرین رکورد امروز یک «ورود» باشد، ورود دوم ثبت نمی‌شود و
 * نوبت «خروج» است. اپ همین را از قبل حساب می‌کند تا برچسب دکمه درست باشد و
 * درخواست بی‌فایده به سرور نرود — ولی **مرجع نهایی سرور است**، چون دو کلیک
 * هم‌زمان یا دادهٔ کهنه می‌تواند اپ را از سرور عقب بیندازد.
 */

export type PunchIntent = 'start' | 'pause';

export interface TodayState {
  /** `dmy` روزِ کاری. */
  dmy: number | null;
  /** ساعت اولین ورود امروز. */
  entry: string | null;
  /** ساعت آخرین خروج امروز (اگر رخ داده باشد). */
  exit: string | null;
  /** اگر همین حالا داخل است، ساعت ورودِ باز. */
  openSince: string | null;
  /** همین حالا داخل ساختمان است؟ */
  present: boolean;
  /** کاری که با دکمهٔ اصلی باید انجام شود. */
  nextIntent: PunchIntent;
  punches: PunchRow[];
  /** دقیقه‌های کارکرد امروز (شامل ساعتِ باز، اگر `now` بدهید). */
  minutes: number | null;
  /** همان کارکرد، ولی با دقتِ ثانیه — تایمرِ زنده روی این حساب می‌کند. */
  seconds: number | null;
}

export const PUNCH_LABEL: Record<PunchIntent, string> = {
  start: 'ثبت حضور',
  pause: 'ثبت خروج',
};

/**
 * دادهٔ سرور را قابل‌اعتماد می‌کند.
 *
 * `start`/`pause` در سامانه عدد ۰/۱ هستند ولی مسیرهای قدیمی وب آن‌ها را به
 * شکل رشته برمی‌گردانند، پس هر دو حالت را می‌پذیریم. ترتیب هم بر اساس
 * `H:i:s` مرتب می‌شود که چون صفرپر است، مقایسهٔ رشته‌ای جواب می‌دهد.
 *
 * رکوردی که نه `start` است و نه `pause` یک «زدن کارت» نیست و دور ریخته
 * می‌شود؛ نگه داشتنش باعث می‌شود آخرین رویداد روز اشتباه حساب شود. اگر هر دو
 * یک باشند، ورود مقدم است — `SavedTimeController` هرگز چنین رکوردی نمی‌سازد.
 */
export function normalizeRows(rows: PunchRow[] | null | undefined): PunchRow[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && typeof row.time === 'string' && row.time.length > 0)
    .map((row) => {
      const start = Number(row.start) === 1;
      const pause = Number(row.pause) === 1;

      if (start) return { time: row.time, start: 1, pause: 0 };

      return { time: row.time, start: 0, pause: pause ? 1 : 0 };
    })
    .filter((row) => row.start === 1 || row.pause === 1)
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
}

function lastIndexWhere(rows: PunchRow[], predicate: (row: PunchRow) => boolean): number {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (predicate(rows[i])) return i;
  }
  return -1;
}

function firstIndexWhere(rows: PunchRow[], predicate: (row: PunchRow) => boolean): number {
  for (let i = 0; i < rows.length; i += 1) {
    if (predicate(rows[i])) return i;
  }
  return -1;
}

export function deriveToday(
  rows: PunchRow[] | null | undefined,
  options: { dmy?: number | null; now?: string | null } = {},
): TodayState {
  const punches = normalizeRows(rows);

  const firstStart = firstIndexWhere(punches, (row) => row.start === 1);
  const lastStart = lastIndexWhere(punches, (row) => row.start === 1);
  const lastPause = lastIndexWhere(punches, (row) => row.pause === 1);

  const entry = firstStart >= 0 ? punches[firstStart].time : null;
  const exit = lastPause >= 0 ? punches[lastPause].time : null;
  // «همین حالا داخل است» = آخرین رویداد یک ورود بوده، نه خروج.
  const present = lastStart >= 0 && lastStart > lastPause;
  const openSince = present ? punches[lastStart].time : null;

  const worked = workedSeconds(punches, { now: options.now ?? null });

  return {
    dmy: options.dmy ?? null,
    entry,
    exit,
    openSince,
    present,
    nextIntent: present ? 'pause' : 'start',
    punches,
    minutes: worked === null ? null : Math.floor(worked / 60),
    seconds: worked,
  };
}

/**
 * جمع ثانیه‌های کارکرد. جفت‌های «ورود→خروج» جمع می‌شوند و اگر شیفت هنوز باز
 * است، تا `now` شمرده می‌شود (همان کاری که تایمر پنل می‌کند).
 *
 * مبنای محاسبه ثانیه است نه دقیقه: تایمرِ زنده هر ثانیه از همین تابع رد
 * می‌شود، و اگر مبنا دقیقه بود، عدد تا یک دقیقهٔ کامل تکان نمی‌خورد.
 */
export function workedSeconds(
  rows: PunchRow[] | null | undefined,
  options: { now?: string | null } = {},
): number | null {
  const punches = normalizeRows(rows);

  let total = 0;
  let openAt: string | null = null;
  let sawAny = false;

  for (const row of punches) {
    if (row.start === 1) {
      openAt = row.time;
    } else if (row.pause === 1) {
      if (openAt !== null) {
        const span = secondsBetweenSafe(openAt, row.time);
        if (span !== null) total += span;
      }
      openAt = null;
    }
    sawAny = true;
  }

  if (openAt !== null && options.now) {
    const span = secondsBetweenSafe(openAt, options.now);
    if (span !== null) total += span;
  }

  if (!sawAny) return null;
  return total;
}

/**
 * طولِ شیفتی که این خروج می‌بندد، به دقیقه.
 *
 * صفحهٔ سابقه با آن نشان می‌دهد هر خروج چقدر شیفت بوده؛ بدون آن، «خروج
 * ۱۲:۰۰» به‌تنهایی هیچ معنایی ندارد. ورودی **باید به ترتیب زمانی** باشد —
 * همان ترتیبی که API می‌فرستد؛ عمداً مرتب نمی‌کنیم تا ایندکسِ ورودی و ردیفِ
 * نمایش‌داده‌شده یکی بماند و رنگی که کنار هر ردیف می‌آید با خودش جابه‌جا نشود.
 */
export function closingSpanMinutes(rows: PunchRow[] | null | undefined, index: number): number | null {
  if (!Array.isArray(rows)) return null;

  const exit = rows[index];

  // ورود شیفتی را نمی‌بندد، پس طولی هم ندارد.
  if (!exit || Number(exit.pause) !== 1) return null;

  for (let i = index - 1; i >= 0; i -= 1) {
    if (Number(rows[i]?.start) === 1) {
      return workedMinutes([
        { time: rows[i].time, start: 1, pause: 0 },
        { time: exit.time, start: 0, pause: 1 },
      ]);
    }
  }

  // خروجی که ورودی برایش پیدا نشد (دادهٔ ناقص): بی‌طول بماند، حدس نزنیم.
  return null;
}

/** دقیقه‌های کارکرد؛ همان ثانیه‌ها، گرد‌شده به پایین. */
export function workedMinutes(
  rows: PunchRow[] | null | undefined,
  options: { now?: string | null } = {},
): number | null {
  const seconds = workedSeconds(rows, options);
  return seconds === null ? null : Math.floor(seconds / 60);
}

/** بدون import از `jalali.ts` نگه داشته می‌شود تا این ماژول خودبسنده بماند. */
function secondsBetweenSafe(from: string, to: string): number | null {
  const a = parseHms(from);
  const b = parseHms(to);
  if (a === null || b === null) return null;

  const span = b - a;
  return span < 0 ? null : span;
}

/** `H:i:s` → ثانیهٔ روز؛ مقدار نامعتبر → null. */
function parseHms(value: string): number | null {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] ?? 0);

  if (h > 23 || m > 59 || s > 59) return null;

  return h * 3600 + m * 60 + s;
}
