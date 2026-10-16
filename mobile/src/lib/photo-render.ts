/*
 * اجرایِ ویرایش روی خودِ فایل — لایهٔ دستگاهِ ویرایشگرِ عکس.
 *
 * چرا جدا از `photo-edit.ts`: آن فایل فقط ریاض است (تست‌پذیر بدون گوشی)؛
 * این یکی کارِ واقعی را می‌کند: فایل را می‌چرخاند، می‌بُرد و فشرده می‌کند.
 *
 * ترتیبِ دو گامِ چرخش عمدی است و به همان دلیلِ WYSIWYG در `photo-edit.ts`:
 *   ۱) چرخش — و گرفتنِ اندازهٔ **واقعی** بومِ چرخیده از خودِ کتابخانه،
 *      نه حدسِ اینجا. پلتفرم‌ها گِردِ اعدادشان فرق دارد (ceil در اندروید،
 *      ترازِ پیکسل در iOS، بومِ کنوا در وب) و یک پیکسلِ اشتباه یعنی برشِ
 *      یک‌طرفه یا خطای مرزِ کتابخانه.
 *   ۲) برشِ مربع با همان `cropRect` که تست‌ها تضمین کرده‌اند: داخلِ بوم،
 *      داخلِ محتوا، و دقیقاً همان چیزی که پیش‌نمایش نشان داد.
 *
 * وقتی زاویه صفر است چرخشی در کار نیست: نه فایلِ واسطِ اضافه‌ای نوشته
 * می‌شود، نه کیفیتِ یک نسلِ JPEG بی‌دلیل می‌رود — همان یک برش کافی است.
 *
 * خروجی همیشه JPEG با کیفیت `PHOTO_QUALITY` است (قابِ مربعِ نهایی)، با
 * `mimeType` صریح تا `photoFileName` و `isWebPhotoUri` همان مسیرِ قبلی را
 * طی کنند و آپلود بی‌هیچ شاخهٔ جدیدی کار کند.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { cropRect } from './photo-edit';
import type { Point, Size } from './photo-edit';
import { PHOTO_QUALITY } from './profile-photo';
import type { PickedPhoto } from './profile-photo';

/** وضعیتِ ویرایشِ خواسته‌شده — همان چهار عددی که پیش‌نمایش با آن رندر شد. */
export interface PhotoEdit {
  /** زاویهٔ نهایی بر حسب درجه (چرخشِ ساعتی مثبت، مثل خودِ کتابخانه). */
  angle: number;
  /** بزرگ‌نمایی (۱ تا ۳). */
  zoom: number;
  /** جابه‌جاییِ قاب روی صفحه، پیکسل. */
  pan: Point;
  /** اندازهٔ قابِ مربع روی صفحه، پیکسل — پلِ بین صفحه و تصویر. */
  frame: number;
}

/**
 * عکسِ ویرایش‌شدهٔ نهایی — آمادهٔ همان `setPhoto` که قبل از ویرایشگر بود.
 *
 * اندازه‌های نتیجه از خودِ کتابخانه می‌آید (فایلِ ذخیره‌شده)، نه از حسابِ
 * اینجا؛ پس هر وقت پلتفرم یک پیکسل جابه‌جا کرد، زنجیرهٔ بعدی (پنل وب،
 * دایرهٔ پروفایل) چیزی اشتباهی نمی‌بیند.
 */
export async function renderSquarePhoto(photo: PickedPhoto, edit: PhotoEdit): Promise<PickedPhoto> {
  const source: Size = { width: photo.width ?? 0, height: photo.height ?? 0 };

  if (!(source.width > 0) || !(source.height > 0)) {
    // بدون اندازه، نه پیش‌نمایش درست می‌شود نه برش. ویرایشگر پیش از این
    // چک را باز نمی‌کند؛ اینجا فقط مرزِ نهایی است تا عددِ خراب به
    // کتابخانه نرسد.
    throw new Error('photo_size_unknown');
  }

  const angle = Number.isFinite(edit.angle) ? edit.angle : 0;
  let currentUri = photo.uri;
  let rotated: Size = source;

  if (angle % 360 !== 0) {
    const ref = await ImageManipulator.manipulate(currentUri).rotate(angle).renderAsync();
    // میان‌ذخیره با کیفیت کامل: فقط برای اینکه اندازهٔ واقعیِ بوم و نشانیِ
    // آن را بگیریم؛ نسلِ اول JPEG با q=1 افتِ مرئی ندارد و برشِ نهایی
    // همان بهینه‌سازیِ `PHOTO_QUALITY` را می‌خورد.
    const saved = await ref.saveAsync({ compress: 1, format: SaveFormat.JPEG });
    currentUri = saved.uri;
    rotated = { width: saved.width, height: saved.height };
  }

  const rect = cropRect(source, rotated, angle, edit.zoom, edit.pan, edit.frame);
  const cropped = await ImageManipulator.manipulate(currentUri).crop(rect).renderAsync();
  const final = await cropped.saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG });

  return {
    uri: final.uri,
    // نام و نوع را `photoFileName`/`photoMimeType` از روی همین‌ها می‌سازند:
    // خروجی همیشه JPEG است، پس نام پیش‌فرض `avatar.jpg` می‌شود — همان قراردادِ
    // قبل از ویرایشگر، تا سرور هیچ تفاوتی در درخواست نبیند.
    fileName: null,
    mimeType: 'image/jpeg',
    // حجمِ فایلِ نو را نداریم؛ `checkPhoto` فقط وقتی عدد است می‌سنجد و سقفِ
    // ۸ مگابایت را خودِ سرور اعمال می‌کند (خروجیِ ۰٫۷ چند برابر کوچک‌تر است).
    fileSize: null,
    width: final.width,
    height: final.height,
  };
}
