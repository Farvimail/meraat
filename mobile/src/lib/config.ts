/**
 * تنظیمات زمان اجرا.
 *
 * `EXPO_PUBLIC_*` تنها راهی است که Expo بدون هیچ پکیج اضافه‌ای در باندل
 * جای‌گذاری می‌کند؛ مقدار در زمان build داخل کد نوشته می‌شود. برای عوض کردن
 * آدرس سرور بدون دست زدن به کد، فایل `.env` کنار `package.json` بسازید:
 *
 *   EXPO_PUBLIC_API_URL=https://meraat.piqagram.ir/api/v1
 */

const env: Record<string, string | undefined> =
  (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env ?? {};

export const DEFAULT_API_BASE_URL = 'https://meraat.piqagram.ir/api/v1';

export const API_BASE_URL = (env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, '');

/**
 * مبدأِ سرور بدون پیشوندِ API — برای فایل‌های ثابتی که در ریشهٔ دامنه سرو
 * می‌شوند نه زیر `/api/v1`، مثل عکس پروفایل (`images/users/…`).
 */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

/** نشانیِ کامل یک فایل ثابت روی همان سرورِ API. */
export function assetUrl(path: string): string {
  return `${API_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

/**
 * عکسِ پیش‌فرضِ پروفایل — همان فایلی که پنل وب برای کارمندِ بی‌عکس نشان
 * می‌دهد (`public/images/users/PRP.jpg` روی خودِ سرور).
 *
 * کدِ اپ وقتی کارمند عکس نداشته باشد این را می‌دهد، نه `null`؛ وگرنه در گوشی
 * دایره‌ای با حروفِ اول دیده می‌شود و در پنل چهرهٔ پیش‌فرض — دو چهرهٔ متفاوت
 * برای یک کارمند. حروفِ اوّل فقط وقتی می‌آید که خودِ همین تصویر هم بارگذاری
 * نشود (مثلاً قطع بودنِ اینترنت).
 */
/*
 * `?v=` عمداً جزوِ نشانی است و باید هر بار که خودِ فایلِ پیش‌فرض روی سرور عوض
 * شد بالا برود.
 *
 * چرا لازم است: کشِ تصویرِ گوشی (و مرورگرِ پنل) با «نشانی» کلید می‌خورد، نه
 * با محتوا. تا وقتی نشانی همان `.../PRP.jpg` بماند، فایلِ تازهٔ سرور هرگز
 * گرفته نمی‌شود و کاربر روی گوشی همان تصویرِ قدیمی را می‌بیند — یعنی «عکس
 * پیش‌فرض عوض نشده» به نظر می‌رسد، در حالی که سرور فایلِ تازه را می‌دهد.
 *
 * عکسِ خودِ کارمندان این مشکل را ندارد: هر بارگذاری نامِ فایلِ تازه می‌گیرد،
 * پس نشانی‌شان خودش عوض می‌شود.
 */
export const DEFAULT_AVATAR_VERSION = '2';

export const DEFAULT_AVATAR = `images/users/PRP.jpg?v=${DEFAULT_AVATAR_VERSION}`;

/** نام قابل‌خوان برای پنل مدیریت، تا معلوم باشد کدام گوشی به کارمند بسته شده. */
export const DEVICE_NAME = env.EXPO_PUBLIC_DEVICE_NAME ?? 'گوشی کارمند';

export const REQUEST_TIMEOUT_MS = 15000;

/** کلیدهای ذخیره‌سازی امن روی دستگاه. */
export const STORAGE_KEYS = {
  token: 'meraat.session.token',
  employee: 'meraat.session.employee',
  deviceId: 'meraat.device.id',
  deviceSecret: 'meraat.device.secret',
} as const;
