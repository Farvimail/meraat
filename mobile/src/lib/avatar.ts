/* پسوندِ `.ts` عمدی است: همین فایل با `node --test` هم اجرا می‌شود و آن‌جا
   نشانیِ بی‌پسوند حل نمی‌شود. مترو (باندلِ اپ) مسیرِ کامل را همان‌طور
   می‌خواند. */
import { DEFAULT_AVATAR, assetUrl } from './config.ts';

/**
 * نشانی‌های عکسِ پروفایل، به ترتیبِ اولویت.
 *
 * ۱) عکسِ خودِ کارمند — اگر سرور نامِ فایل داده باشد.
 * ۲) عکسِ پیش‌فرضِ سرور — همان که پنل هم برای کارمندِ بی‌عکس نشان می‌دهد.
 *
 * ترتیب مهم است: اگر عکسِ خودِ کارمند بارگذاری نشود (فایل پاک شده، آفلاین،
 * اینترنتِ لحظه‌ای)، اپ باید «چهرهٔ پیش‌فرض» را بکشد نه حروفِ اوّلِ نام؛
 * وگرنه برای یک کارمند دو چهرهٔ متفاوت (گوشی و پنل) دیده می‌شود. حروفِ اوّل
 * فقط آخرین پشتوانه است — وقتی هیچ‌کدام از این دو تصویر نیامده باشد.
 */
export function avatarSources(avatar?: string | null): string[] {
  const sources: string[] = [];
  const name = (avatar ?? '').trim();

  if (name) sources.push(assetUrl(`images/users/${encodeURIComponent(name)}`));

  const fallback = assetUrl(DEFAULT_AVATAR);

  if (!sources.includes(fallback)) sources.push(fallback);

  return sources;
}
