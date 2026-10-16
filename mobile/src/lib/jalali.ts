/**
 * تاریخ و ساعت شمسی، بدون هیچ وابستگی بیرونی.
 *
 * چرا خودمان نوشتیم: اپ باید روی گوشی بدون اینترنت هم تاریخ را درست نشان دهد،
 * و `Intl` روی همهٔ نسخه‌های Hermes تقویم فارسی کامل ندارد. این همان الگوریتم
 * استاندارد جلالی است و در `__tests__/jalali.test.ts` با نوروزهای شناخته‌شده
 * تست شده است.
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقام لاتین را به ارقام فارسی تبدیل می‌کند (۰۸:۱۵). */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

/** تعداد روزهای میلادی که پیش از هر ماه گذشته‌اند (ژانویه = ۰). */
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  // برای مارس به بعد، سالِ کبیسه‌ی مؤثر یکی جلوتر است.
  const gy2 = gm > 2 ? gy + 1 : gy;

  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    DAYS_BEFORE_MONTH[gm - 1];

  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;

  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

  return { jy, jm, jd };
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/** نام روز هفته با اندیس `Date.getDay()` (یکشنبه = ۰). */
export const WEEKDAYS = [
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
  'شنبه',
];

/** «۲۱ مهر ۱۴۰۵» */
export function formatJalaliLong(date: Date): string {
  const { jy, jm, jd } = gregorianToJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

/**
 * `dmy` سامانه را به تاریخ میلادی برمی‌گرداند.
 *
 * ستون `tbl_calendar.dmy` با `date('dmY')` ساخته می‌شود، یعنی فقط رقم: روز،
 * ماه، سال — مثل `13102026` برای ۱۳ اکتبر ۲۰۲۶. چون صفرهای ابتدایی در عدد
 * گم می‌شوند، طول رشته هم بررسی می‌شود.
 */
export function parseDmy(dmy: number): Date | null {
  const text = String(dmy);

  if (!/^\d{8}$/.test(text)) return null;

  const day = Number(text.slice(0, 2));
  const month = Number(text.slice(2, 4));
  const year = Number(text.slice(4, 8));

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return new Date(year, month - 1, day);
}

/** «۲۱ مهر ۱۴۰۵» از `dmy` سامانه. */
export function formatDmyLong(dmy: number): string {
  const date = parseDmy(dmy);
  return date ? formatJalaliLong(date) : '—';
}

/** «شنبه ۲۱ مهر» */
export function formatJalaliShort(date: Date): string {
  const { jm, jd } = gregorianToJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return `${WEEKDAYS[date.getDay()]} ${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;
}

export interface Clock {
  h: number;
  m: number;
  s: number;
}

/**
 * رشتهٔ ساعتی که سامانه ذخیره می‌کند (`tbl_saved_time.time` یک varchar با
 * مقدار `H:i:s` است) را تجزیه می‌کند. مقدار نامعتبر → null.
 */
export function parseClock(value: string): Clock | null {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) return null;

  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = Number(match[3] ?? 0);

  if (h > 23 || m > 59 || s > 59) return null;

  return { h, m, s };
}

/** `08:15:00` → `۰۸:۱۵` */
export function formatClock(value: string | null | undefined): string {
  if (!value) return '—';

  const clock = parseClock(value);
  if (!clock) return '—';

  const text = `${String(clock.h).padStart(2, '0')}:${String(clock.m).padStart(2, '0')}`;
  return toPersianDigits(text);
}

/**
 * `08:32:05` → `۰۸:۳۲:۰۵` — همان `formatClock`، ولی با ثانیه.
 *
 * ساعتِ سرصفحه به ثانیه نیاز دارد تا معلوم باشد زنده است؛ ساعتِ ورود/خروج نه.
 */
export function formatClockWithSeconds(value: string | null | undefined): string {
  if (!value) return '--:--:--';

  const clock = parseClock(value);
  if (!clock) return '--:--:--';

  return toPersianDigits(
    [clock.h, clock.m, clock.s].map((part) => String(part).padStart(2, '0')).join(':'),
  );
}

/** دقیقه‌های بین دو ساعت؛ اگر ساعت دوم قبل از اولی باشد یا نامعتبر، null. */
export function minutesBetween(from: string, to: string): number | null {
  const a = parseClock(from);
  const b = parseClock(to);

  if (!a || !b) return null;

  const minutes = b.h * 60 + b.m - (a.h * 60 + a.m);
  return minutes < 0 ? null : minutes;
}

/** «۹ ساعت و ۵ دقیقه» */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return '—';

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${toPersianDigits(rest)} دقیقه`;
  if (rest === 0) return `${toPersianDigits(hours)} ساعت`;

  return `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`;
}

/** «شنبه ۲۱ مهر ۱۴۰۵» — روز هفته هم می‌آید، چون سرصفحه به آن نیاز دارد. */
export function formatJalaliFull(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${formatJalaliLong(date)}`;
}

/** همان «شنبه ۲۱ مهر ۱۴۰۵»، ولی از `dmy` سرور — نه از تاریخ گوشی. */
export function formatDmyFull(dmy: number): string {
  const date = parseDmy(dmy);
  return date ? formatJalaliFull(date) : '—';
}

/**
 * ثانیه → «۰۲:۱۷:۴۳» برای تایمر کارکرد.
 *
 * ساعت می‌تواند از ۲۴ بگذرد (شیفت طولانی)، پس سقفی نمی‌گذاریم؛ فقط با دو رقم
 * پر می‌شود تا عرض متن موقع تیک‌خوردن نلرزد.
 */
export function formatStopwatch(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '—';

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return toPersianDigits([h, m, s].map((part) => String(part).padStart(2, '0')).join(':'));
}
