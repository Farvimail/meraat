import * as SecureStore from 'expo-secure-store';

import { STORAGE_KEYS } from './config';
import { toCrashRecord } from './crash-record';
import type { CrashRecord } from './crash-record';

/**
 * «آخرین خطای مرگبار» — چرا این فایل وجود دارد.
 *
 * اپ روی بعضی گوشی‌ها بعد از ورود یک‌باره بسته می‌شد و هیچ اثری از خودش
 * نمی‌گذاشت: در buildِ release نه صفحهٔ سرخِ توسعه هست، نه کنسولی که کسی
 * ببیندش. نتیجه این بود که تنها گزارشِ ما جملهٔ «کلاً بسته می‌شود» بود.
 *
 * حالا هر خطای مرگبار (چه در رندر، چه در یک promiseِ رهاشده) یک سطر کوتاه در
 * حافظهٔ امنِ گوشی می‌گذارد و صفحهٔ ورود همان را نشان می‌دهد. این هم برای
 * کاربرِ همین حالا مفید است (می‌فهمد اپ چرا بسته شد و می‌تواند اسکرین‌شات
 * بفرستد) و هم برای ما: پیامِ دقیقِ خطا، جای حدس‌زدن.
 */

export { toCrashRecord } from './crash-record';
export type { CrashRecord } from './crash-record';

/** ذخیرهٔ خطا؛ هرگز خطا پرت نمی‌کند (خودش نباید باعثِ خطای بعدی شود). */
export async function recordCrash(record: CrashRecord): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEYS.lastCrash, JSON.stringify(record));
  } catch {
    // ذخیره‌نشدنِ گزارش نباید چیزی را خراب کند.
  }
}

export async function readCrash(): Promise<CrashRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEYS.lastCrash);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return null;

    const record = parsed as Partial<CrashRecord>;

    if (typeof record.message !== 'string' || record.message.trim() === '') return null;

    return {
      where: record.where === 'render' ? 'render' : 'global',
      message: record.message,
      stack: typeof record.stack === 'string' ? record.stack : null,
      at: typeof record.at === 'string' ? record.at : '',
    };
  } catch {
    return null;
  }
}

export async function clearCrash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.lastCrash);
  } catch {
    // پاک‌نشدن هم مهم نیست؛ پیام بعدی جای این را می‌گیرد.
  }
}

/** شکلِ کوچکی از `ErrorUtils`ِ ری‌اکت‌نیتیو؛ فقط همان چیزی که لازم داریم. */
interface GlobalErrorUtils {
  getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
}

/**
 * گرفتنِ خطاهای رهاشده (promiseهای بدونِ `catch`) — همان‌هایی که در release
 * اپ را می‌بندند و هیچ پیامی جا نمی‌گذارند.
 *
 * `ErrorUtils` بخشی از ری‌اکت‌نیتیو است و روی وب/نود وجود ندارد؛ پس با
 * `typeof` سنجیده می‌شود. هندلرِ قبلی هم صدا زده می‌شود تا رفتارِ خودِ
 * فریم‌ورک (بستن در release، صفحهٔ سرخ در توسعه) عوض نشود؛ ما فقط گزارش
 * می‌گیریم.
 */
export function installCrashHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;

  if (!errorUtils || typeof errorUtils.setGlobalHandler !== 'function') return;

  const previous = typeof errorUtils.getGlobalHandler === 'function' ? errorUtils.getGlobalHandler() : null;

  errorUtils.setGlobalHandler((error, isFatal) => {
    // فقط خطاهای مرگبار ارزشِ ثبت دارند؛ بقیه در توسعه دیده می‌شوند.
    if (isFatal) {
      void recordCrash(toCrashRecord('global', error));
    }

    if (previous) {
      previous(error, isFatal);
    }
  });
}
